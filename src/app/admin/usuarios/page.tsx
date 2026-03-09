'use client';

import { useState } from 'react';
import { addDays, format } from 'date-fns';
import { useAdminKey } from '../layout';

interface UserResult {
  id: string;
  name: string;
  phone: string;
  blocked_until: string | null;
  created_at: string;
}

export default function AdminUsuariosPage() {
  const { adminKey } = useAdminKey();

  const [phone, setPhone]             = useState('');
  const [user, setUser]               = useState<UserResult | null>(null);
  const [searching, setSearching]     = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const [blockDate, setBlockDate]   = useState(tomorrow);
  const [blocking, setBlocking]     = useState(false);
  const [blockMsg, setBlockMsg]     = useState<string | null>(null);
  const [blockError, setBlockError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setSearching(true);
    setSearchError(null);
    setUser(null);
    setBlockMsg(null);
    setBlockError(null);

    const res  = await fetch('/api/admin/users/info', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ adminKey, phone: phone.trim() }),
    });
    const data = await res.json();
    setSearching(false);

    if (!res.ok) {
      setSearchError(data.error ?? 'Error al buscar');
    } else {
      setUser(data.user);
    }
  };

  const handleBlock = async (blockedUntil: string | null) => {
    if (!user) return;
    setBlocking(true);
    setBlockMsg(null);
    setBlockError(null);

    const res  = await fetch('/api/admin/users/block', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ adminKey, phone: user.phone, blocked_until: blockedUntil }),
    });
    const data = await res.json();
    setBlocking(false);

    if (!res.ok) {
      setBlockError(data.error ?? 'Error al actualizar');
    } else {
      setBlockMsg(data.message);
      setUser(data.user);
    }
  };

  const isBlocked = !!user?.blocked_until;

  return (
    <div className="space-y-8 max-w-lg">
      <h1 className="text-xl font-bold text-gray-900">Usuarios</h1>

      {/* Search */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
          Buscar usuario por teléfono
        </h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="11-1234-5678"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <button
            type="submit"
            disabled={searching || !phone.trim()}
            className="bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {searching ? 'Buscando…' : 'Buscar'}
          </button>
        </form>
        {searchError && (
          <p className="mt-3 text-sm text-red-600">{searchError}</p>
        )}
      </div>

      {/* User card */}
      {user && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-gray-900 text-lg">{user.name}</p>
              <p className="text-sm text-gray-500">{user.phone}</p>
              <p className="text-xs text-gray-400 mt-1">
                Registrado: {new Date(user.created_at).toLocaleDateString('es-AR')}
              </p>
            </div>
            <span className={[
              'text-xs font-semibold px-3 py-1 rounded-full',
              isBlocked
                ? 'bg-red-100 text-red-700'
                : 'bg-green-100 text-green-700',
            ].join(' ')}>
              {isBlocked ? `Bloqueado hasta ${user.blocked_until}` : 'Activo'}
            </span>
          </div>

          <hr className="border-gray-100" />

          {!isBlocked ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Bloquear hasta:</p>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={blockDate}
                  min={tomorrow}
                  onChange={(e) => setBlockDate(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                />
                <button
                  onClick={() => handleBlock(blockDate)}
                  disabled={blocking}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
                >
                  {blocking ? 'Bloqueando…' : 'Bloquear'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => handleBlock(null)}
              disabled={blocking}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
            >
              {blocking ? 'Desbloqueando…' : 'Desbloquear usuario'}
            </button>
          )}

          {blockMsg && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
              {blockMsg}
            </p>
          )}
          {blockError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              {blockError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
