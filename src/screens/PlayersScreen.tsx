import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { navigate } from '../App';
import { Card, Chip, TextInput } from '../components/ui';
import { db } from '../db';

export default function PlayersScreen() {
  const players = useLiveQuery(() => db.players.orderBy('rating').reverse().toArray(), []) ?? [];
  const [q, setQ] = useState('');
  const shown = players.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate({ name: 'home' })} className="text-2xl leading-none text-slate-400">
          ‹
        </button>
        <h1 className="text-xl font-bold">Thư viện ({players.length})</h1>
      </div>
      <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên…" />

      {shown.map((p) => (
        <Card key={p.id} className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">
              {p.name} <span className="text-xs text-slate-500">{p.gender === 'F' ? '♀' : '♂'}</span>
            </div>
            <div className="text-xs text-slate-500">
              {p.matchesPlayed} trận · thắng {p.matchesPlayed ? Math.round((p.wins / p.matchesPlayed) * 100) : 0}%
              {p.facebookUrl ? ' · có FB' : ''}
            </div>
          </div>
          {p.owedBonus && <Chip tone="amber">ưu tiên</Chip>}
          <div className="text-right">
            <div className="font-bold text-teal-300">{p.rating}</div>
            <div className="text-xs text-slate-500">{p.levelLabel}</div>
          </div>
          <button
            onClick={() => confirm(`Xoá ${p.name} khỏi thư viện?`) && db.players.delete(p.id)}
            className="px-1 text-slate-600"
          >
            ✕
          </button>
        </Card>
      ))}
      {!shown.length && <Card className="text-center text-sm text-slate-400">Chưa có ai.</Card>}
    </div>
  );
}
