'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminKey } from '../layout';
import type { Price } from '@/types';

const DURATION_LABELS: Record<number, string> = {
  60:  '1 hora',
  90:  '1½ hora',
  120: '2 horas',
};

type PriceRow = Price & { draft: string };

export default function AdminPreciosPage() {
  const { adminKey } = useAdminKey();

  const [rows, setRows]               = useState<PriceRow[]>([]);
  const [luzStartTime, setLuzStartTime] = useState('19:00');
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const fetchPrices = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/admin/prices?adminKey=${encodeURIComponent(adminKey)}`);
      const data = await res.json();
      setRows((data.prices ?? []).map((p: Price) => ({ ...p, draft: String(p.amount) })));
      setLuzStartTime(data.luzStartTime ?? '19:00');
    } catch {
      setError('Error al cargar los precios.');
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  useEffect(() => { fetchPrices(); }, [fetchPrices]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const prices = rows.map((r) => ({ id: r.id, amount: Number(r.draft) || 0 }));
      const res = await fetch('/api/admin/prices', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ adminKey, prices, luzStartTime }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  const updateDraft = (id: number, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, draft: value } : r)));
  };

  // Group by member/non-member
  const memberRows    = rows.filter((r) => r.is_member);
  const nonMemberRows = rows.filter((r) => !r.is_member);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Lista de precios</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors"
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>

      {saved && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 text-sm">
          Precios actualizados correctamente.
        </div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Luz start time */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Horario de corte para precio con luz
            </h2>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600">A partir de las</label>
              <input
                type="time"
                value={luzStartTime}
                onChange={(e) => setLuzStartTime(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <span className="text-sm text-gray-500">se aplica el precio "con luz"</span>
            </div>
          </div>

          {/* Socios */}
          <PriceGroup
            title="Socios"
            rows={memberRows}
            onUpdate={updateDraft}
          />

          {/* No socios */}
          <PriceGroup
            title="No socios"
            rows={nonMemberRows}
            onUpdate={updateDraft}
          />
        </div>
      )}
    </div>
  );
}

function PriceGroup({
  title,
  rows,
  onUpdate,
}: {
  title: string;
  rows: PriceRow[];
  onUpdate: (id: number, value: string) => void;
}) {
  const sinLuz  = rows.filter((r) => !r.con_luz).sort((a, b) => a.duration_minutes - b.duration_minutes);
  const conLuz  = rows.filter((r) =>  r.con_luz).sort((a, b) => a.duration_minutes - b.duration_minutes);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      </div>
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Duración</th>
            <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sin luz</th>
            <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Con luz</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sinLuz.map((row) => {
            const luzRow = conLuz.find((r) => r.duration_minutes === row.duration_minutes);
            return (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-medium text-gray-800">
                  {DURATION_LABELS[row.duration_minutes] ?? `${row.duration_minutes} min`}
                </td>
                <td className="px-5 py-3">
                  <PriceInput row={row} onUpdate={onUpdate} />
                </td>
                <td className="px-5 py-3">
                  {luzRow ? <PriceInput row={luzRow} onUpdate={onUpdate} /> : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PriceInput({ row, onUpdate }: { row: PriceRow; onUpdate: (id: number, value: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-gray-400 text-sm">$</span>
      <input
        type="number"
        min={0}
        step={500}
        value={row.draft}
        onChange={(e) => onUpdate(row.id, e.target.value)}
        className="w-28 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 text-right"
      />
    </div>
  );
}
