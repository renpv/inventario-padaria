import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { parseVoiceInput } from '../utils/fuzzyMatcher';
import { enqueueOfflineAction } from '../services/offlineQueue';
import { getOperationalDayRangeISO } from '../utils/operationalDay';
import { Mic, MicOff, Plus, Minus, PackageX, PackageMinus, RefreshCw } from 'lucide-react';

interface Setor {
  id_setor: string;
  nome_setor: string;
}

interface Produto {
  id_produto: string;
  nome_produto: string;
  unidade_medida: string;
}

export const SobrasPerdas: React.FC = () => {
  const [tipo, setTipo] = useState<'Sobra' | 'Perda'>('Perda');
  const [setores, setSetores] = useState<Setor[]>([]);
  const [selectedSetor, setSelectedSetor] = useState('');
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [observacoes, setObservacoes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [voiceAlert, setVoiceAlert] = useState<string | null>(null);

  useEffect(() => {
    const fetchSetores = async () => {
      const { data } = await supabase.from('setores').select('id_setor, nome_setor').eq('ativo', 'SIM');
      setSetores(data || []);
      if (data && data.length > 0) setSelectedSetor(data[0].id_setor);
      setLoading(false);
    };
    fetchSetores();
  }, []);

  useEffect(() => {
    if (!selectedSetor) return;
    const fetchProdutos = async () => {
      const { data } = await supabase
        .from('produtos')
        .select('id_produto, nome_produto, unidade_medida')
        .eq('id_setor', selectedSetor)
        .eq('ativo', 'SIM');
      setProdutos(data || []);
      setQuantidades({});
      setObservacoes({});
    };
    fetchProdutos();
  }, [selectedSetor]);

  const handleTranscript = (text: string) => {
    const match = parseVoiceInput(text, produtos);
    if (match) {
      setQuantidades((prev) => ({ ...prev, [match.productId]: match.quantity }));
      setVoiceAlert(`Combinou: "${match.nomeProduto}" com ${match.quantity}`);
      setTimeout(() => setVoiceAlert(null), 3000);
    } else {
      setVoiceAlert(`Sem correspondência: "${text}"`);
      setTimeout(() => setVoiceAlert(null), 3000);
    }
  };

  const { isListening, startListening, stopListening, isSupported } = useSpeechToText({ onTranscript: handleTranscript });

  const adjust = (id_produto: string, delta: number) => {
    setQuantidades((prev) => ({ ...prev, [id_produto]: Math.max(0, (prev[id_produto] || 0) + delta) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lancados = produtos.filter((p) => (quantidades[p.id_produto] || 0) > 0);
    if (lancados.length === 0) {
      alert(`Informe ao menos uma quantidade de ${tipo.toLowerCase()} antes de enviar.`);
      return;
    }

    setSubmitting(true);
    try {
      // Vincula ao turno em andamento hoje, se houver (apenas para
      // referência temporal — sobras e perdas não alteram o ciclo de vida do
      // turno nem o estoque atual, RF-11).
      const { startISO, endISO } = getOperationalDayRangeISO();
      const { data: turnoAtual } = await supabase
        .from('lancamentos_op')
        .select('id_turno')
        .eq('tipo', 'Inventário')
        .eq('status', 'EM ANDAMENTO')
        .gte('data', startISO)
        .lt('data', endISO)
        .limit(1)
        .maybeSingle();

      const id_lancamento = crypto.randomUUID();
      const lancamentoPayload = {
        id_lancamento,
        id_turno: turnoAtual?.id_turno || null,
        tipo,
        status: 'CONFIRMADO' as const,
      };
      const itensPayload = lancados.map((p) => ({
        id_lancamento,
        id_produto: p.id_produto,
        qtd_loja: quantidades[p.id_produto],
        qtd_estoque: 0,
        qtd_total: quantidades[p.id_produto],
        observacao_motivo: observacoes[p.id_produto] || null,
      }));

      const queue = async (message: string) => {
        await enqueueOfflineAction('lancamentos_op', 'INSERT', lancamentoPayload);
        await enqueueOfflineAction('lancamentos_itens', 'INSERT', itensPayload);
        alert(message);
        setQuantidades({});
        setObservacoes({});
      };

      if (!navigator.onLine) {
        await queue('Sem conexão: o lançamento foi salvo e será sincronizado automaticamente.');
        return;
      }

      const { error: logError } = await supabase.from('lancamentos_op').insert(lancamentoPayload);
      if (logError) {
        console.error('Failed to insert lancamento (sobra/perda), queueing for retry:', logError);
        await queue('Não foi possível enviar agora. O lançamento foi salvo e será sincronizado automaticamente.');
        return;
      }

      const { error: itensError } = await supabase.from('lancamentos_itens').insert(itensPayload);
      if (itensError) {
        console.error('Failed to insert itens (sobra/perda), queueing for retry:', itensError);
        await enqueueOfflineAction('lancamentos_itens', 'INSERT', itensPayload);
      }

      alert(`${tipo} registrada com sucesso!`);
      setQuantidades({});
      setObservacoes({});
    } catch (err) {
      console.error('Unexpected error submitting sobra/perda:', err);
      alert('Falha inesperada. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-stone-400">
        <RefreshCw className="animate-spin text-amber-500 mb-2" size={32} />
        <span>Carregando setores...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 relative">
      {voiceAlert && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 w-80 bg-amber-500 text-stone-900 px-4 py-2.5 rounded-xl shadow-lg border border-amber-400 z-50 text-xs font-bold text-center animate-bounce">
          {voiceAlert}
        </div>
      )}

      <div className="bg-stone-850 p-4 rounded-xl border border-stone-800 space-y-4">
        <h2 className="text-lg font-bold text-amber-500">Sobras e Perdas</h2>
        <p className="text-xs text-stone-400">
          Lançamentos de auditoria: não alteram o estoque atual do produto.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTipo('Perda')}
            className={`py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 border ${
              tipo === 'Perda' ? 'bg-rose-600/20 border-rose-600/50 text-rose-400' : 'bg-stone-900 border-stone-700 text-stone-400'
            }`}
          >
            <PackageX size={16} /> Perda
          </button>
          <button
            type="button"
            onClick={() => setTipo('Sobra')}
            className={`py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 border ${
              tipo === 'Sobra' ? 'bg-emerald-600/20 border-emerald-600/50 text-emerald-400' : 'bg-stone-900 border-stone-700 text-stone-400'
            }`}
          >
            <PackageMinus size={16} /> Sobra
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">Setor</label>
          <select
            value={selectedSetor}
            onChange={(e) => setSelectedSetor(e.target.value)}
            className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-stone-200"
          >
            {setores.map((s) => (
              <option key={s.id_setor} value={s.id_setor}>
                {s.nome_setor}
              </option>
            ))}
          </select>
        </div>

        {isSupported && (
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            className={`w-full py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 ${
              isListening ? 'bg-rose-500 text-stone-100 animate-pulse' : 'bg-amber-600 text-stone-900'
            }`}
          >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            {isListening ? 'Ouvindo...' : 'Ditar quantidades'}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {produtos.map((p) => (
          <div key={p.id_produto} className="bg-stone-850 p-4 rounded-xl border border-stone-800 space-y-2">
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold text-stone-200">{p.nome_produto}</h3>
              <span className="text-xs text-stone-500 uppercase font-bold">{p.unidade_medida}</span>
            </div>
            <div className="flex items-center justify-between bg-stone-900 border border-stone-800 rounded-lg p-1">
              <button type="button" onClick={() => adjust(p.id_produto, -1)} className="p-1.5 hover:bg-stone-800 rounded text-stone-400">
                <Minus size={14} />
              </button>
              <input
                type="number"
                min="0"
                value={quantidades[p.id_produto] || 0}
                onChange={(e) => setQuantidades((prev) => ({ ...prev, [p.id_produto]: parseFloat(e.target.value) || 0 }))}
                className="w-16 bg-transparent text-center text-sm font-semibold text-stone-200 focus:outline-none"
              />
              <button type="button" onClick={() => adjust(p.id_produto, 1)} className="p-1.5 hover:bg-stone-800 rounded text-stone-400">
                <Plus size={14} />
              </button>
            </div>
            {(quantidades[p.id_produto] || 0) > 0 && (
              <input
                type="text"
                placeholder="Motivo (opcional)"
                value={observacoes[p.id_produto] || ''}
                onChange={(e) => setObservacoes((prev) => ({ ...prev, [p.id_produto]: e.target.value }))}
                className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-300"
              />
            )}
          </div>
        ))}

        {produtos.length > 0 && (
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl font-bold bg-amber-600 hover:bg-amber-500 text-stone-900 disabled:opacity-50"
          >
            {submitting ? 'Enviando...' : `Registrar ${tipo}`}
          </button>
        )}
      </form>
    </div>
  );
};
