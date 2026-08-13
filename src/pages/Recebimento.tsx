import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { parseVoiceInput } from '../utils/fuzzyMatcher';
import type { Product } from '../components/ProductList';
import {
  ArrowLeft,
  PackageCheck,
  Plus,
  Minus,
  Mic,
  MicOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
} from 'lucide-react';

interface ItemRecebimento extends Product {
  qtd_esperada?: number;
}

interface ResultadoItem {
  id_produto: string;
  nome_produto: string;
  qtd_esperada: number;
  qtd_recebida: number;
  divergencia: 'Conforme' | 'Faltou' | 'Veio a mais' | 'Veio trocado';
}

const divergenciaStyle: Record<ResultadoItem['divergencia'], string> = {
  Conforme: 'text-emerald-400 bg-emerald-950/40 border-emerald-900',
  Faltou: 'text-rose-400 bg-rose-950/40 border-rose-900',
  'Veio a mais': 'text-amber-400 bg-amber-950/40 border-amber-900',
  'Veio trocado': 'text-rose-400 bg-rose-950/40 border-rose-900',
};

const divergenciaIcon: Record<ResultadoItem['divergencia'], React.ReactNode> = {
  Conforme: <CheckCircle2 size={14} />,
  Faltou: <XCircle size={14} />,
  'Veio a mais': <AlertTriangle size={14} />,
  'Veio trocado': <AlertTriangle size={14} />,
};

export const Recebimento: React.FC = () => {
  const [searchParams] = useSearchParams();
  const idPedido = searchParams.get('pedido');

  const [loading, setLoading] = useState(true);
  const [fornecedorNome, setFornecedorNome] = useState<string | null>(null);
  const [pedidoStatus, setPedidoStatus] = useState<string | null>(null);
  const [itens, setItens] = useState<ItemRecebimento[]>([]);
  const [recebidas, setRecebidas] = useState<Record<string, number>>({});
  const [voiceAlert, setVoiceAlert] = useState<string | null>(null);

  const [catalogo, setCatalogo] = useState<Product[]>([]);
  const [busca, setBusca] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [resultado, setResultado] = useState<ResultadoItem[] | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      if (idPedido) {
        const [pedidoRes, itensRes] = await Promise.all([
          supabase.from('pedidos_compra').select('status, fornecedores(nome)').eq('id_pedido', idPedido).maybeSingle(),
          supabase
            .from('pedidos_itens')
            .select('id_produto, quantidade, produtos(nome_produto, unidade_medida)')
            .eq('id_pedido', idPedido),
        ]);

        if (pedidoRes.data) {
          const fornecedor = pedidoRes.data.fornecedores as unknown as { nome: string } | null;
          setFornecedorNome(fornecedor?.nome || 'Fornecedor');
          setPedidoStatus(pedidoRes.data.status as string);
        }

        if (itensRes.data) {
          const list: ItemRecebimento[] = itensRes.data.map((it) => {
            const produto = it.produtos as unknown as { nome_produto: string; unidade_medida: string } | null;
            return {
              id_produto: it.id_produto,
              nome_produto: produto?.nome_produto || 'Produto',
              unidade_medida: produto?.unidade_medida || 'un',
              qtd_esperada: Number(it.quantidade),
            };
          });
          setItens(list);
          const initial: Record<string, number> = {};
          list.forEach((i) => {
            initial[i.id_produto] = i.qtd_esperada ?? 0;
          });
          setRecebidas(initial);
        }
      } else {
        const { data } = await supabase
          .from('produtos')
          .select('id_produto, nome_produto, unidade_medida')
          .eq('ativo', 'SIM')
          .order('nome_produto');
        setCatalogo(data || []);
      }
      setLoading(false);
    };
    load();
  }, [idPedido]);

  const isAvulso = !idPedido;

  const handleTranscript = (text: string) => {
    const alvo: Product[] = isAvulso ? itens : itens;
    const match = parseVoiceInput(text, alvo);
    if (match) {
      if (isAvulso && !itens.some((i) => i.id_produto === match.productId)) {
        const produto = catalogo.find((p) => p.id_produto === match.productId);
        if (produto) setItens((prev) => [...prev, produto]);
      }
      setRecebidas((prev) => ({ ...prev, [match.productId]: match.quantity }));
      setVoiceAlert(`Combinou: "${match.nomeProduto}" com ${match.quantity}`);
      setTimeout(() => setVoiceAlert(null), 3000);
    } else {
      setVoiceAlert(`Sem correspondência: "${text}"`);
      setTimeout(() => setVoiceAlert(null), 3000);
    }
  };

  const { isListening, startListening, stopListening, isSupported } = useSpeechToText({ onTranscript: handleTranscript });

  const adjust = (id_produto: string, delta: number) => {
    setRecebidas((prev) => ({ ...prev, [id_produto]: Math.max(0, (prev[id_produto] || 0) + delta) }));
  };

  const addAvulsoProduto = (p: Product) => {
    if (itens.some((i) => i.id_produto === p.id_produto)) return;
    setItens((prev) => [...prev, p]);
    setRecebidas((prev) => ({ ...prev, [p.id_produto]: 0 }));
    setBusca('');
  };

  const removeAvulsoProduto = (id_produto: string) => {
    setItens((prev) => prev.filter((i) => i.id_produto !== id_produto));
    setRecebidas((prev) => {
      const next = { ...prev };
      delete next[id_produto];
      return next;
    });
  };

  const catalogoFiltrado = useMemo(() => {
    if (!busca.trim()) return [];
    const termo = busca.toLowerCase();
    return catalogo
      .filter((p) => !itens.some((i) => i.id_produto === p.id_produto))
      .filter((p) => p.nome_produto.toLowerCase().includes(termo))
      .slice(0, 8);
  }, [busca, catalogo, itens]);

  const handleSubmit = async () => {
    if (itens.length === 0) {
      alert('Adicione ao menos um produto antes de confirmar o recebimento.');
      return;
    }
    if (!navigator.onLine) {
      alert('É necessário estar online para conferir o recebimento — tente novamente com conexão.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = itens.map((i) => ({
        id_produto: i.id_produto,
        qtd_recebida: recebidas[i.id_produto] ?? 0,
      }));

      const { error } = await supabase.rpc('conferir_recebimento', {
        p_id_pedido: idPedido || null,
        p_itens: payload,
      });

      if (error) {
        alert('Não foi possível registrar a conferência: ' + error.message);
        return;
      }

      if (idPedido) {
        const { data: recData } = await supabase
          .from('recebimentos_itens')
          .select('id_produto, qtd_esperada, qtd_recebida, divergencia, produtos(nome_produto)')
          .eq('id_pedido', idPedido)
          .order('created_at', { ascending: false });

        if (recData) {
          const seen = new Set<string>();
          const dedup: ResultadoItem[] = [];
          for (const r of recData) {
            if (seen.has(r.id_produto)) continue;
            seen.add(r.id_produto);
            const produto = r.produtos as unknown as { nome_produto: string } | null;
            dedup.push({
              id_produto: r.id_produto,
              nome_produto: produto?.nome_produto || 'Produto',
              qtd_esperada: Number(r.qtd_esperada),
              qtd_recebida: Number(r.qtd_recebida),
              divergencia: r.divergencia as ResultadoItem['divergencia'],
            });
          }
          setResultado(dedup);
        }

        const { data: pedidoAtual } = await supabase
          .from('pedidos_compra')
          .select('status')
          .eq('id_pedido', idPedido)
          .maybeSingle();
        if (pedidoAtual) setPedidoStatus(pedidoAtual.status as string);
      } else {
        setResultado(
          itens.map((i) => ({
            id_produto: i.id_produto,
            nome_produto: i.nome_produto,
            qtd_esperada: recebidas[i.id_produto] ?? 0,
            qtd_recebida: recebidas[i.id_produto] ?? 0,
            divergencia: 'Conforme',
          }))
        );
      }
    } catch (err) {
      console.error('Unexpected error conferring recebimento:', err);
      alert('Falha inesperada ao registrar a conferência. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-stone-400">
        <RefreshCw className="animate-spin text-amber-500 mb-2" size={32} />
        <span>Carregando recebimento...</span>
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

      <div className="flex items-center gap-4 bg-stone-850 p-4 rounded-xl border border-stone-800 sticky top-0 z-10">
        <Link to="/gestao/pedidos" className="p-2 hover:bg-stone-800 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-stone-300" />
        </Link>
        <div>
          <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
            <PackageCheck size={18} /> Conferir Recebimento
          </h2>
          <p className="text-xs text-stone-400">
            {idPedido ? `Pedido de ${fornecedorNome || 'fornecedor'}${pedidoStatus ? ` · ${pedidoStatus}` : ''}` : 'Recebimento avulso (sem pedido)'}
          </p>
        </div>
      </div>

      {resultado ? (
        <div className="space-y-3">
          <div className="bg-stone-850 p-4 rounded-xl border border-stone-800 space-y-1">
            <h3 className="font-bold text-stone-200 text-sm">Conferência registrada</h3>
            <p className="text-xs text-stone-400">Resumo por produto:</p>
          </div>
          {resultado.map((r) => (
            <div
              key={r.id_produto}
              className={`p-4 rounded-xl border flex items-center justify-between text-sm ${divergenciaStyle[r.divergencia]}`}
            >
              <div>
                <p className="font-semibold text-stone-100">{r.nome_produto}</p>
                <p className="text-xs opacity-80">
                  Esperado: {r.qtd_esperada} &bull; Recebido: {r.qtd_recebida}
                </p>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase">
                {divergenciaIcon[r.divergencia]} {r.divergencia}
              </span>
            </div>
          ))}
          <Link
            to="/gestao/pedidos"
            className="w-full block text-center py-3 bg-stone-800 text-stone-200 rounded-xl font-bold text-sm"
          >
            Voltar aos pedidos
          </Link>
        </div>
      ) : (
        <>
          {isAvulso && (
            <div className="bg-stone-850 p-4 rounded-xl border border-stone-800 space-y-2 relative">
              <label className="block text-xs font-bold text-stone-400 uppercase tracking-wider">
                Adicionar produto
              </label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
                <input
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar produto..."
                  className="w-full bg-stone-900 border border-stone-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-stone-200 outline-none"
                />
              </div>
              {catalogoFiltrado.length > 0 && (
                <div className="bg-stone-900 border border-stone-800 rounded-lg overflow-hidden">
                  {catalogoFiltrado.map((p) => (
                    <button
                      key={p.id_produto}
                      type="button"
                      onClick={() => addAvulsoProduto(p)}
                      className="w-full text-left px-3 py-2 text-sm text-stone-300 hover:bg-stone-800 flex items-center justify-between"
                    >
                      {p.nome_produto}
                      <Plus size={14} className="text-amber-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {isSupported && itens.length > 0 && (
            <button
              type="button"
              onClick={isListening ? stopListening : startListening}
              className={`w-full py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 ${
                isListening ? 'bg-rose-500 text-stone-100 animate-pulse' : 'bg-amber-600 text-stone-900'
              }`}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              {isListening ? 'Ouvindo...' : 'Ditar quantidades recebidas'}
            </button>
          )}

          {itens.length === 0 ? (
            <div className="bg-stone-850 p-6 rounded-xl border border-stone-800 text-center text-stone-500 text-sm">
              {isAvulso
                ? 'Busque produtos acima para iniciar o recebimento avulso.'
                : 'Este pedido não possui itens.'}
            </div>
          ) : (
            <div className="space-y-3">
              {itens.map((p) => (
                <div key={p.id_produto} className="bg-stone-850 p-4 rounded-xl border border-stone-800 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-semibold text-stone-200">{p.nome_produto}</h3>
                    <div className="flex items-center gap-2">
                      {p.qtd_esperada !== undefined && (
                        <span className="text-xs text-stone-500">esperado: {p.qtd_esperada}</span>
                      )}
                      <span className="text-xs text-stone-500 uppercase font-bold">{p.unidade_medida}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-stone-900 border border-stone-800 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => adjust(p.id_produto, -1)}
                      className="p-1.5 hover:bg-stone-800 rounded text-stone-400"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={recebidas[p.id_produto] ?? 0}
                      onChange={(e) =>
                        setRecebidas((prev) => ({ ...prev, [p.id_produto]: parseFloat(e.target.value) || 0 }))
                      }
                      className="w-16 bg-transparent text-center text-sm font-semibold text-stone-200 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => adjust(p.id_produto, 1)}
                      className="p-1.5 hover:bg-stone-800 rounded text-stone-400"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  {isAvulso && (
                    <button
                      type="button"
                      onClick={() => removeAvulsoProduto(p.id_produto)}
                      className="text-[11px] text-rose-400 hover:text-rose-300"
                    >
                      Remover produto
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-3.5 rounded-xl font-bold bg-amber-600 hover:bg-amber-500 text-stone-900 disabled:opacity-50"
              >
                {submitting ? 'Registrando...' : 'Confirmar Conferência'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
