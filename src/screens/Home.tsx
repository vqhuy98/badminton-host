import { useLiveQuery } from 'dexie-react-hooks';
import { useRef } from 'react';
import { navigate } from '../App';
import { Banner, Button, Card, Chip } from '../components/ui';
import { db, downloadBackup, importBackup, type Backup } from '../db';
import { createSession } from '../lib/actions';
import { computeMoney, formatVnd } from '../lib/money';

export default function Home() {
  const sessions = useLiveQuery(() => db.sessions.orderBy('createdAt').reverse().toArray(), []);
  const playerCount = useLiveQuery(() => db.players.count(), []);
  const fileRef = useRef<HTMLInputElement>(null);

  const totalProfit = (sessions ?? []).reduce((t, s) => t + computeMoney(s).profit, 0);

  async function onImport(file: File) {
    try {
      const data = JSON.parse(await file.text()) as Backup;
      const r = await importBackup(data);
      const review = r.needsReview.length
        ? `\n⚠ ${r.needsReview.length} người trùng tên nhưng khác khoá — vào Thư viện kiểm tra, app không tự gộp.`
        : '';
      alert(`Đã nhập: +${r.playersAdded} người, gộp ${r.playersMerged}, +${r.sessionsAdded} buổi.${review}`);
    } catch (e) {
      alert(`Nhập thất bại: ${(e as Error).message}`);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <header className="flex items-end justify-between pt-2">
        <div>
          <h1 className="text-2xl font-bold">Cầu lông vãng lai</h1>
          <p className="text-sm text-slate-400">
            {sessions?.length ?? 0} buổi · {playerCount ?? 0} người trong thư viện
          </p>
        </div>
      </header>

      {!!sessions?.length && (
        <Banner level={totalProfit >= 0 ? 'ok' : 'danger'}>
          Lãi/lỗ luỹ kế: <b>{formatVnd(totalProfit)}</b>
        </Banner>
      )}

      <Button
        className="w-full"
        onClick={async () => navigate({ name: 'session', id: await createSession() })}
      >
        + Tạo buổi mới
      </Button>

      <div className="grid grid-cols-3 gap-2">
        <Button variant="ghost" onClick={() => navigate({ name: 'players' })}>
          Thư viện
        </Button>
        <Button variant="ghost" onClick={downloadBackup}>
          Sao lưu
        </Button>
        <Button variant="ghost" onClick={() => fileRef.current?.click()}>
          Nhập lại
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])}
      />

      <div className="space-y-2">
        {sessions?.map((s) => {
          const m = computeMoney(s);
          return (
            <button
              key={s.id}
              onClick={() => navigate({ name: 'session', id: s.id })}
              className="w-full rounded-2xl border border-line bg-panel p-4 text-left active:bg-panel2"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{s.venue || 'Chưa đặt tên sân'}</span>
                <Chip tone={m.profit >= 0 ? 'emerald' : 'rose'}>{formatVnd(m.profit)}</Chip>
              </div>
              <div className="mt-1 text-sm text-slate-400">
                {s.date} · {s.courtCount} sân · {s.durationMin} phút · {s.attendees.length} người
              </div>
            </button>
          );
        })}
        {sessions?.length === 0 && (
          <Card className="text-center text-sm text-slate-400">
            Chưa có buổi nào. Bấm “Tạo buổi mới” để bắt đầu.
          </Card>
        )}
      </div>
    </div>
  );
}
