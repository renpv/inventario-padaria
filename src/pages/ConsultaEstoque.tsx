import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Search, RefreshCw, AlertTriangle } from 'lucide-react';

interface EstoqueRow {
  id_produto: string;
  nome_produto: string;
  unidade_medida: string;
  estoque_atual: number;
  estoque_minimo: number;
}

export const ConsultaEstoque: React.FC = () => {
  const [rows, setRows] = useState<EstoqueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const fetchEstoque = async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('consultar_estoque');
      if (!error && data) {
        setRows(data as EstoqueRow[]);
      } else if (error) {
        console.error('Falha ao consultar estoque:', error);
      }
      setLoading(false);
    };
    fetchEstoque();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.nome_produto.toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-stone-850 p-4 rounded-xl border border-stone-800 space-y-3">
        <h2 className="text-lg font-bold text-amber-500">Consulta de Estoque</h2>
        <p className="text-xs text-stone-400">Saldo consolidado (loja + retaguarda) dos produtos ativos.</p>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produto..."
            className="w-full bg-stone-900 border border-stone-700 rounded-lg pl-9 pr-3 py-3 text-sm text-stone-200 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] text-stone-400">
          <RefreshCw className="animate-spin text-amber-500 mb-2" size={28} />
          <span>Carregando estoque...</span>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="bg-stone-850 p-6 rounded-xl border border-stone-800 text-center text-stone-500 text-sm">
              Nenhum produto encontrado.
            </div>
          )}
          {filtered.map((r) => {
            const abaixoMinimo = r.estoque_atual < r.estoque_minimo;
            return (
              <div key={r.id_produto} className="bg-stone-850 p-4 rounded-xl border border-stone-800 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-stone-200">{r.nome_produto}</p>
                  <p className="text-xs text-stone-500">Mínimo: {r.estoque_minimo} {r.unidade_medida}</p>
                </div>
                <div className="text-right flex items-center gap-2">
                  {abaixoMinimo && <AlertTriangle size={14} className="text-rose-500" />}
                  <div>
                    <p className={`font-bold ${abaixoMinimo ? 'text-rose-500' : 'text-stone-100'}`}>
                      {r.estoque_atual} {r.unidade_medida}
                    </p>
                    <p className="text-[10px] text-stone-500 uppercase">Saldo atual</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
