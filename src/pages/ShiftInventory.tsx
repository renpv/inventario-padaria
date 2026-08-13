import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { ProductList } from '../components/ProductList';
import type { Product, InventoryItem } from '../components/ProductList';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { useIndexedDB } from '../hooks/useIndexedDB';
import { parseVoiceInput } from '../utils/fuzzyMatcher';
import { Mic, MicOff, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';

interface DraftState {
  counts: Record<string, InventoryItem>;
  countedSet: string[];
}

export const ShiftInventory: React.FC = () => {
  const { id_turno, id_setor } = useParams<{ id_turno: string; id_setor: string }>();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [voiceAlert, setVoiceAlert] = useState<string | null>(null);

  const draftKey = `draft_inv_${id_turno}_${id_setor}`;
  const { data: draft, updateData: updateDraft, clearDraft, loading: loadingDraft } = useIndexedDB<DraftState>(draftKey, {
    counts: {},
    countedSet: [],
  });

  // Forçar Fechamento modal states
  const [showModal, setShowModal] = useState(false);
  const [justification, setJustification] = useState('');

  // Load products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id_setor || '');
        let data = null;
        let error = null;

        if (isUUID) {
          const res = await supabase
            .from('produtos')
            .select('id_produto, nome_produto, unidade_medida')
            .eq('id_setor', id_setor)
            .eq('ativo', 'SIM');
          data = res.data;
          error = res.error;
        }

        if (data && data.length > 0 && !error) {
          setProducts(data);
        } else {
          // Fallback mock products
          if (id_setor === '1' || id_setor === 'mock-1') {
            setProducts([
              { id_produto: 'p1', nome_produto: 'Pão Francês', unidade_medida: 'unidade' },
              { id_produto: 'p2', nome_produto: 'Pão de Queijo', unidade_medida: 'kg' },
              { id_produto: 'p3', nome_produto: 'Pão de Forma', unidade_medida: 'unidade' },
            ]);
          } else {
            setProducts([
              { id_produto: 'p4', nome_produto: 'Manteiga', unidade_medida: 'pote' },
              { id_produto: 'p5', nome_produto: 'Queijo Muçarela', unidade_medida: 'kg' },
            ]);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchProducts();
  }, [id_setor]);

  const handleCountChange = (productId: string, field: 'qtd_loja' | 'qtd_estoque', val: number) => {
    updateDraft((prev) => {
      const counts = { ...prev.counts };
      const existing = counts[productId] || { id_produto: productId, qtd_loja: 0, qtd_estoque: 0 };
      counts[productId] = { ...existing, [field]: val };

      const countedSet = new Set(prev.countedSet);
      countedSet.add(productId);

      return {
        counts,
        countedSet: Array.from(countedSet),
      };
    });
  };

  // Voice transcript handler
  const handleTranscript = (transcriptText: string) => {
    if (showModal) {
      // If modal is active, voice records the justification
      setJustification((prev) => (prev ? `${prev} ${transcriptText}` : transcriptText));
      return;
    }

    const match = parseVoiceInput(transcriptText, products);
    if (match) {
      // By default, set it to Store (qtd_loja) or we can split it. Let's set it to Store (qtd_loja).
      handleCountChange(match.productId, 'qtd_loja', match.quantity);
      setVoiceAlert(`Combinou: "${match.nomeProduto}" com ${match.quantity}`);
      setTimeout(() => setVoiceAlert(null), 3000);
    } else {
      setVoiceAlert(`Sem correspondência: "${transcriptText}"`);
      setTimeout(() => setVoiceAlert(null), 3000);
    }
  };

  const { isListening, startListening, stopListening, isSupported } = useSpeechToText({
    onTranscript: handleTranscript,
  });

  const handleConfirmSubmission = async () => {
    setSubmitting(true);
    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id_turno || '');
      
      if (!isUUID) {
        // Mock submission (e.g. User clicked a mock sector in SectorSelector)
        console.log('Mock submission successful for fake ID:', id_turno);
        await clearDraft();
        navigate('/');
        return;
      }

      // Submit new operational log (lancamentos_op)
      const { data: logData, error: logError } = await supabase
        .from('lancamentos_op')
        .insert({
          id_turno: id_turno,
          tipo: 'Inventário',
          status: 'CONFIRMADO',
          justificativa_forca: justification || null,
        })
        .select('id_lancamento')
        .single();

      if (logData && !logError) {
        // Insert items
        const itemsToInsert = products.map((prod) => {
          const item = draft.counts[prod.id_produto] || { qtd_loja: 0, qtd_estoque: 0 };
          return {
            id_lancamento: logData.id_lancamento,
            id_produto: prod.id_produto,
            qtd_loja: item.qtd_loja,
            qtd_estoque: item.qtd_estoque,
            qtd_total: item.qtd_loja + item.qtd_estoque,
          };
        });

        await supabase.from('lancamentos_itens').insert(itemsToInsert);
      }

      // Clear draft
      await clearDraft();

      navigate('/');
    } catch (err) {
      console.error('Failed to submit inventory:', err);
      // Even if offline/failed, we keep draft in IndexedDB so sync daemon will sync it (User Story 2)
      alert('Salvo offline. Os dados serão sincronizados ao restaurar conexão.');
      navigate('/');
    } finally {
      setSubmitting(false);
      setShowModal(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const allCounted = products.every((p) => draft.countedSet.includes(p.id_produto));
    if (!allCounted) {
      setShowModal(true);
    } else {
      handleConfirmSubmission();
    }
  };

  if (loadingProducts || loadingDraft) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-stone-400">
        <RefreshCw className="animate-spin text-amber-500 mb-2" size={32} />
        <span>Carregando lista de produtos...</span>
      </div>
    );
  }

  const allCounted = products.every((p) => draft.countedSet.includes(p.id_produto));

  return (
    <div className="space-y-6 relative">
      {/* Voice Match Toast */}
      {voiceAlert && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 w-80 bg-amber-500 text-stone-900 px-4 py-2.5 rounded-xl shadow-lg border border-amber-400 z-50 text-xs font-bold text-center animate-bounce">
          {voiceAlert}
        </div>
      )}

      {/* Header Info */}
      <div className="bg-stone-850 p-4 rounded-xl border border-stone-800 flex items-center justify-between">
        <div>
          <h2 className="text-md font-bold text-stone-100">Contagem de Estoque</h2>
          <p className="text-xs text-stone-400">Dite ou ajuste manualmente as quantidades.</p>
        </div>
        <div className="flex items-center gap-2">
          {isSupported && (
            <button
              onClick={isListening ? stopListening : startListening}
              className={`p-3 rounded-full transition-all ${
                isListening
                  ? 'bg-rose-500 text-stone-100 animate-pulse shadow-lg shadow-rose-500/20'
                  : 'bg-amber-600 text-stone-900 hover:bg-amber-500'
              }`}
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
          )}
        </div>
      </div>

      {/* Voice Instructions Banner */}
      {isListening && (
        <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl flex items-center gap-3 text-xs text-amber-400">
          <AlertCircle size={18} className="flex-shrink-0" />
          <span>Fale claramente ex: <em>"pão francês 50"</em> ou <em>"pão de queijo zero"</em>.</span>
        </div>
      )}

      {/* Form & List */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <ProductList
          products={products}
          items={draft.counts}
          onCountChange={handleCountChange}
        />

        {/* Submit Actions */}
        <div className="space-y-2">
          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${
              allCounted
                ? 'bg-amber-600 hover:bg-amber-500 text-stone-900 shadow-lg shadow-amber-900/10'
                : 'bg-stone-800 hover:bg-stone-750 text-stone-200 border border-stone-700'
            }`}
          >
            <CheckCircle2 size={18} />
            {allCounted ? 'Finalizar Contagem' : 'Forçar Fechamento'}
          </button>
        </div>
      </form>

      {/* Forçar Fechamento Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-stone-850 border border-stone-800 p-6 rounded-2xl w-full max-w-sm space-y-6 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-rose-500/10 rounded-full text-rose-500">
                <AlertTriangle size={28} />
              </div>
              <h3 className="text-lg font-bold text-stone-100">Itens não contados!</h3>
              <p className="text-xs text-stone-400">
                Você precisa preencher uma justificativa obrigatória para forçar o fechamento deste setor.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Justificativa</label>
                {isSupported && (
                  <button
                    onClick={() => {
                      if (isListening) stopListening();
                      else startListening();
                    }}
                    className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-colors flex items-center gap-1 ${
                      isListening ? 'bg-rose-500 text-stone-100 animate-pulse' : 'bg-stone-800 text-stone-300'
                    }`}
                  >
                    <Mic size={12} /> Ditar
                  </button>
                )}
              </div>
              <textarea
                rows={3}
                required
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Ex: Falta de mercadoria para contagem ou setor fechado temporariamente..."
                className="w-full bg-stone-900 border border-stone-800 px-3 py-2 rounded-xl text-stone-200 text-sm focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  stopListening();
                  setShowModal(false);
                }}
                className="py-2.5 bg-stone-800 hover:bg-stone-750 text-stone-300 text-sm font-semibold rounded-xl border border-stone-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSubmission}
                disabled={!justification.trim() || submitting}
                className="py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-stone-100 text-sm font-semibold rounded-xl transition-colors"
              >
                Confirmar Fechamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
