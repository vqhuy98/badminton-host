import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { navigate } from '../App';
import { Card, Chip, ConfirmSheet, IconButton, IconTrash, TextInput, toast } from '../components/ui';
import { db } from '../db';
import { deletePlayer, restorePlayer } from '../lib/actions';
import type { Player } from '../types';

export default function PlayersScreen() {
  const [del_, setDel] = useState<Player | null>(null);
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
              {p.name} <span className="text-xs text-slate-400">{p.gender === 'F' ? '♀' : '♂'}</span>
            </div>
            <div className="text-xs text-slate-400">
              {p.matchesPlayed} trận · thắng {p.matchesPlayed ? Math.round((p.wins / p.matchesPlayed) * 100) : 0}%
              {p.facebookUrl ? ' · có FB' : ''}
            </div>
          </div>
          {p.owedBonus && <Chip tone="amber">ưu tiên</Chip>}
          <div className="text-right">
            <div className="font-bold text-teal-300">{p.rating}</div>
            <div className="text-xs text-slate-400">{p.levelLabel}</div>
          </div>
          <IconButton label={`Xoá ${p.name} khỏi thư viện`} tone="danger" onClick={() => setDel(p)}>
            <IconTrash className="h-4 w-4" />
          </IconButton>
        </Card>
      ))}
      {!shown.length && <Card className="text-center text-sm text-slate-400">Chưa có ai.</Card>}

      {del_ && (
        <ConfirmSheet
          title={`Xoá ${del_.name}?`}
          confirmLabel="Xoá khỏi thư viện"
          onClose={() => setDel(null)}
          body={
            <>
              Xoá khỏi <b>thư viện</b> — {del_.matchesPlayed} trận đã ghi sẽ mất lịch sử điểm trình.
              Các buổi cũ vẫn giữ tên người này.
              <br />
              Xoá xong vẫn hoàn tác được ngay sau đó.
            </>
          }
          onConfirm={async () => {
            const p = del_;
            setDel(null);
            const snap = await deletePlayer(p.id);
            toast(`Đã xoá ${p.name} khỏi thư viện.`, {
              tone: 'warn',
              undo: async () => {
                await restorePlayer(snap);
                toast(`Đã khôi phục ${p.name}.`);
              },
            });
          }}
        />
      )}
    </div>
  );
}
