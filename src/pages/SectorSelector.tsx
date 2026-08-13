import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { ClipboardList, LayoutGrid, Loader2 } from 'lucide-react';

interface Sector {
  id_setor: string;
  nome_setor: string;
}

interface Shift {
  id_turno: string;
  nome_turno: string;
  ordem: number;
}

export const SectorSelector: React.FC = () => {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedShift, setSelectedShift] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: sectorData } = await supabase
          .from('setores')
          .select('id_setor, nome_setor')
          .eq('ativo', 'SIM');

        const { data: shiftData } = await supabase
          .from('turnos')
          .select('id_turno, nome_turno, ordem')
          .eq('ativo', 'SIM')
          .order('ordem', { ascending: true });

        if (sectorData && sectorData.length > 0) {
          setSectors(sectorData);
        } else {
          // Mock sectors fallback
          setSectors([
            { id_setor: '1', nome_setor: 'Padaria' },
            { id_setor: '2', nome_setor: 'Confeitaria' },
            { id_setor: '3', nome_setor: 'Frios & Laticínios' },
          ]);
        }

        if (shiftData && shiftData.length > 0) {
          setShifts(shiftData);
          setSelectedShift(shiftData[0].id_turno);
        } else {
          // Mock shifts fallback
          const mockShifts = [
            { id_turno: 't1', nome_turno: 'Manhã - entrada', ordem: 1 },
            { id_turno: 't2', nome_turno: 'Manhã - saída', ordem: 2 },
            { id_turno: 't3', nome_turno: 'Tarde - entrada', ordem: 3 },
            { id_turno: 't4', nome_turno: 'Tarde - saída', ordem: 4 },
          ];
          setShifts(mockShifts);
          setSelectedShift(mockShifts[0].id_turno);
        }
      } catch (err) {
        console.error('Erro ao buscar dados:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSectorSelect = (sectorId: string) => {
    if (!selectedShift) return;
    navigate(`/inventario/${selectedShift}/${sectorId}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-stone-400">
        <Loader2 className="animate-spin text-amber-500 mb-2" size={32} />
        <span>Carregando setores e turnos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-stone-850 p-4 rounded-xl border border-stone-800 space-y-4">
        <div className="flex items-center gap-2 text-amber-500">
          <ClipboardList size={22} />
          <h2 className="text-lg font-bold">Iniciar Inventário</h2>
        </div>
        <p className="text-xs text-stone-400">Selecione o turno operacional ativo e o setor físico para iniciar a contagem.</p>
      </div>

      {/* Shift Picker */}
      <div className="space-y-2">
        <label className="text-xs text-stone-400 font-bold uppercase">Turno Operacional</label>
        <select
          value={selectedShift}
          onChange={(e) => setSelectedShift(e.target.value)}
          className="w-full bg-stone-850 border border-stone-800 px-4 py-3 rounded-xl text-stone-200 focus:outline-none focus:border-amber-500"
        >
          {shifts.map((shift) => (
            <option key={shift.id_turno} value={shift.id_turno}>
              {shift.nome_turno}
            </option>
          ))}
        </select>
      </div>

      {/* Sectors Grid */}
      <div className="space-y-3">
        <label className="text-xs text-stone-400 font-bold uppercase">Setores Disponíveis</label>
        <div className="grid grid-cols-1 gap-3">
          {sectors.map((sector) => (
            <button
              key={sector.id_setor}
              onClick={() => handleSectorSelect(sector.id_setor)}
              className="flex items-center justify-between bg-stone-850 hover:bg-stone-800 border border-stone-800 hover:border-amber-500/50 p-4 rounded-xl text-left transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg group-hover:bg-amber-500 group-hover:text-stone-900 transition-colors">
                  <LayoutGrid size={18} />
                </div>
                <span className="font-semibold text-stone-200">{sector.nome_setor}</span>
              </div>
              <span className="text-xs text-stone-500 group-hover:text-amber-500 transition-colors">Contar &rarr;</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
