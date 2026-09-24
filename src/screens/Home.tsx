import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { navigate } from '../App';
import {
  Banner, Button, Card, Chip, ConfirmSheet, Field, IconButton, IconPlus, IconTrash,
  NumberInput, Sheet, TextInput, toast,
} from '../components/ui';
import { db, downloadBackup, importBackup, type Backup } from '../db';
import { createSession, deleteSession, restoreSession } from '../lib/actions';
import { computeMoney, formatVnd } from '../lib/money';
import { sessionStatus } from '../lib/progress';
import type { Session } from '../types';

export default function Home() {
  const sessions = useLiveQuery(() => db.sessions.orderBy('createdAt').reverse().toArray(), []);
  const matches = useLiveQuery(() => db.matches.toArray(), []);
  const playerCount = useLiveQuery(() => db.players.count(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [justMade, setJustMade] = useState<string | null>(null);
  const [del_, setDel] = useState<Session | null>(null);

  const totalProfit = (sessions ?? []).reduce((t, s) => {
    const m = computeMoney(s);
    return m.payingHeads ? t + m.profit : t;   // buoi chua ai toi chua tinh la lo
  }, 0);
  const bySession = new Map<string, typeof matches>();
  (matches ?? []).forEach((m) => {
    const list = bySession.get(m.sessionId) ?? [];
    list.push(m);
    bySession.set(m.sessionId, list);
  });

  async function onImport(file: File) {
    try {
      const data = JSON.parse(await file.text()) as Backup;
      const r = await importBackup(data);
      toast(
        `Đã nhập +${r.playersAdded} người, gộp ${r.playersMerged}, +${r.sessionsAdded} buổi.`,
        { tone: r.needsReview.length ? 'warn' : 'ok' },
      );
      if (r.needsReview.length) {
        toast(`${r.needsReview.length} người trùng tên nhưng khác khoá — vào Thư viện kiểm tra.`, { tone: 'warn' });
      }
    } catch (e) {
      toast(`Nhập thất bại: ${(e as Error).message}`, { tone: 'danger' });
    }
  }

  return (
    <div className="space-y-4 p-4">
      <header className="pt-2">
        <h1 className="text-2xl font-bold">Cầu lông vãng lai</h1>
        <p className="text-sm text-slate-400">
          {sessions?.length ?? 0} buổi · {playerCount ?? 0} người trong thư viện
        </p>
      </header>

      {!!sessions?.length && (
        <Banner level={totalProfit >= 0 ? 'ok' : 'danger'}>
          Lãi/lỗ luỹ kế: <b>{formatVnd(totalProfit)}</b>
        </Banner>
      )}

      <Button className="flex w-full items-center justify-center gap-2 py-5 text-lg"
              onClick={() => setCreating(true)}>
        <IconPlus className="h-5 w-5" /> Tạo buổi mới
      </Button>

      <div className="grid grid-cols-3 gap-2">
        <Button variant="ghost" onClick={() => navigate({ name: 'players' })}>Thư viện</Button>
        <Button variant="ghost" onClick={downloadBackup}>Sao lưu</Button>
        <Button variant="ghost" onClick={() => fileRef.current?.click()}>Nhập lại</Button>
      </div>
      <input ref={fileRef} type="file" accept="application/json" hidden
             onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />

      <div className="space-y-2">
        {sessions?.map((s) => {
          const m = computeMoney(s);
          const st = sessionStatus(bySession.get(s.id) ?? []);
          const fresh = s.id === justMade;
          return (
            <div key={s.id}
              className={`flex items-center gap-1 rounded-2xl border pr-1.5 ${
                fresh ? 'border-teal-500 bg-teal-950/40' : 'border-line bg-panel'
              }`}>
              <button onClick={() => navigate({ name: 'session', id: s.id })}
                      className="min-w-0 flex-1 rounded-2xl p-4 text-left active:bg-panel2">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-semibold">{s.venue || 'Chưa đặt tên sân'}</span>
                  {/* Buoi chua ai toi thi chua co lai/lo that — dung doa host bang so am tien san. */}
                  {!!m.payingHeads && (
                    <Chip tone={m.profit >= 0 ? 'emerald' : 'rose'}>{formatVnd(m.profit)}</Chip>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Chip tone={st.tone}>{st.label}</Chip>
                  <span className="truncate text-sm text-slate-400">
                    {s.date} · {s.courtCount} sân · {s.attendees.length} người
                  </span>
                </div>
              </button>
              <IconButton label={`Xoá buổi ${s.venue || 'chưa đặt tên'}`} tone="danger" onClick={() => setDel(s)}>
                <IconTrash className="h-4 w-4" />
              </IconButton>
            </div>
          );
        })}
        {sessions?.length === 0 && (
          <Card className="text-center text-sm text-slate-400">
            Chưa có buổi nào. Bấm “Tạo buổi mới” để bắt đầu.
          </Card>
        )}
      </div>

      {del_ && (
        <ConfirmSheet
          title="Xoá buổi này?"
          confirmLabel="Xoá buổi"
          onClose={() => setDel(null)}
          body={
            <>
              <b>{del_.venue || 'Buổi chưa đặt tên'}</b> — {del_.date}, {del_.attendees.length} người
              {(bySession.get(del_.id)?.length ?? 0) ? `, ${bySession.get(del_.id)!.length} trận` : ''}.
              <br />
              Xoá xong vẫn hoàn tác được ngay sau đó.
            </>
          }
          onConfirm={async () => {
            const s0 = del_;
            setDel(null);
            const snap = await deleteSession(s0.id);
            const nm = s0.venue || 'Buổi chưa đặt tên';
            toast(`Đã xoá buổi “${nm}”.`, {
              tone: 'warn',
              undo: async () => { await restoreSession(snap); toast(`Đã khôi phục “${nm}”.`); },
            });
          }}
        />
      )}

      {creating && (
        <NewSessionSheet
          onClose={() => setCreating(false)}
          onCreate={async (patch) => {
            const id = await createSession(patch);
            setCreating(false);
            setJustMade(id);
            toast(`Đã tạo buổi “${patch.venue}”. Bấm vào thẻ để mở.`);
          }}
        />
      )}
    </div>
  );
}

/** Hoi truoc khi tao — truoc day bam mot cai la sinh ngay mot buoi rong khong ten. */
function NewSessionSheet({
  onClose, onCreate,
}: {
  onClose: () => void;
  onCreate: (patch: { venue: string; date: string; courtCount: number; durationMin: number }) => void;
}) {
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [courtCount, setCourtCount] = useState(2);
  const [durationMin, setDurationMin] = useState(120);
  const ok = venue.trim().length > 0;

  return (
    <Sheet title="Buổi mới" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Sân / địa điểm">
          <TextInput value={venue} autoFocus placeholder="VD: Tân Phúc"
                     onChange={(e) => setVenue(e.target.value)} />
        </Field>
        <Field label="Ngày">
          <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Số sân">
            <NumberInput value={courtCount} min={1} onChange={setCourtCount} suffix="sân" />
          </Field>
          <Field label="Thời lượng">
            <NumberInput value={durationMin} min={30} step={30} onChange={setDurationMin} suffix="phút" />
          </Field>
        </div>
        {!ok && <p className="text-xs text-slate-400">Đặt tên sân để sau này tìm lại buổi cho dễ.</p>}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button disabled={!ok}
                  onClick={() => onCreate({ venue: venue.trim(), date, courtCount, durationMin })}>
            Tạo buổi
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
