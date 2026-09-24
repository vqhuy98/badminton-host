import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { Banner, Button, Card, Chip } from '../components/ui';
import { db } from '../db';
import { finishMatch, rebalanceUnplayed, shortenFormat, syncCourts } from '../lib/actions';
import { computePacing } from '../lib/pacing';
import type { Match, Session } from '../types';

export default function CourtTab({ session }: { session: Session }) {
  const matches = useLiveQuery(
    () => db.matches.where('sessionId').equals(session.id).sortBy('order'),
    [session.id],
  );
  const players = useLiveQuery(() => db.players.toArray(), []) ?? [];
  const [, tick] = useState(0);
  const [scoring, setScoring] = useState<Match | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => tick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const name = useMemo(() => {
    const m = new Map(players.map((p) => [p.id, p.nickname || p.name]));
    return (id: string) => m.get(id) ?? '???';
  }, [players]);

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const m of matches ?? []) {
      for (const id of [...m.teamA, ...m.teamB]) c.set(id, (c.get(id) ?? 0) + 1);
    }
    return c;
  }, [matches]);

  if (!matches?.length) {
    return (
      <Card className="text-center text-sm text-slate-400">
        Chưa có lịch. Sang tab “Người”, thêm người rồi bấm <b>Xếp lịch</b>.
      </Card>
    );
  }

  const coreCount = matches.filter((m) => m.mandatory).length;
  const pacing = computePacing(session, matches, coreCount);
  const playing = matches.filter((m) => m.state === 'playing');
  const upcoming = matches.filter((m) => m.state === 'queued');
  const started = matches.some((m) => m.state !== 'queued');

  return (
    <div className="space-y-4 pb-6">
      <Banner level={pacing.level}>
        <div>{pacing.message}</div>
        <div className="mt-1 text-xs opacity-80">
          {pacing.actualMinPerMatch
            ? `Thực tế ${pacing.actualMinPerMatch.toFixed(1)} ph/trận`
            : 'Chưa đo được tốc độ'}{' '}
          · từ giờ cần {pacing.requiredMinPerMatch.toFixed(1)} ph/trận · còn {Math.round(pacing.remainingMin)} phút
        </div>
        {(pacing.level === 'warn' || pacing.level === 'danger') && session.format.type === 'points' && session.format.target === 21 && (
          <button
            className="mt-2 rounded-lg border border-current px-2 py-1 text-xs font-semibold"
            onClick={() => shortenFormat(session.id, 15)}
          >
            Rút các trận còn lại xuống 15 điểm
          </button>
        )}
      </Banner>

      {!started && (
        <Button
          className="w-full"
          onClick={async () => {
            await db.sessions.update(session.id, { startAt: Date.now() });
            await syncCourts(session.id);
          }}
        >
          ▶ Bắt đầu buổi
        </Button>
      )}

      {Array.from({ length: session.courtCount }, (_, court) => {
        const m = playing.find((x) => x.courtIndex === court);
        return (
          <Card key={court} className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Sân {court + 1}</span>
              {m ? <Chip tone="teal">Trận {m.order} · {elapsed(m.startedAt)}</Chip> : <Chip>Trống</Chip>}
            </div>
            {m ? (
              <>
                <TeamRow labelA={m.teamA.map(name)} labelB={m.teamB.map(name)} />
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="ghost" onClick={() => finishMatch(m.id)}>
                    Xong, bỏ điểm
                  </Button>
                  <Button onClick={() => setScoring(m)}>Nhập điểm</Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-400">
                {upcoming.length ? 'Bấm “Bắt đầu buổi” hoặc kết thúc trận bên kia để đẩy trận lên.' : 'Hết lịch.'}
              </p>
            )}
          </Card>
        );
      })}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Lịch ({upcoming.length} chưa đánh)</h2>
          <button
            className="text-xs text-teal-300"
            onClick={async () => setNote(`Đã cân lại ${await rebalanceUnplayed(session.id)} trận chưa đánh.`)}
          >
            Cân lại theo trình mới
          </button>
        </div>
        {note && <Banner level="info">{note}</Banner>}
        <div className="mt-2 space-y-1">
          {matches.map((m, i) => {
            const prevMandatory = i > 0 && matches[i - 1].mandatory;
            return (
              <div key={m.id}>
                {prevMandatory && !m.mandatory && (
                  <div className="my-3 flex items-center gap-2">
                    <div className="h-px flex-1 bg-teal-600" />
                    <span className="text-xs font-bold tracking-wide text-teal-400">
                      VẠCH {session.minPerPlayer} TRẬN
                    </span>
                    <div className="h-px flex-1 bg-teal-600" />
                  </div>
                )}
                <MatchRow m={m} name={name} />
              </div>
            );
          })}
        </div>
      </div>

      <Card>
        <h2 className="mb-2 font-semibold">Số trận mỗi người</h2>
        <div className="flex flex-wrap gap-2">
          {[...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([id, c]) => (
              <Chip key={id} tone={c < session.minPerPlayer ? 'rose' : c > session.minPerPlayer ? 'emerald' : 'slate'}>
                {name(id)} {c}
              </Chip>
            ))}
        </div>
        {!!session.shortChanged.length && (
          <p className="mt-2 text-xs text-slate-400">
            Chỉ được {session.minPerPlayer} trận (tổng chỗ không chia hết):{' '}
            {session.shortChanged.map(name).join(', ')} — sẽ được ưu tiên buổi sau.
          </p>
        )}
      </Card>

      {scoring && (
        <ScoreSheet
          match={scoring}
          name={name}
          target={session.format.type === 'points' ? session.format.target : 21}
          onClose={() => setScoring(null)}
          onSave={async (a, b) => {
            await finishMatch(scoring.id, a, b);
            setScoring(null);
          }}
        />
      )}
    </div>
  );
}

function elapsed(from?: number) {
  if (!from) return '0:00';
  const s = Math.max(0, Math.floor((Date.now() - from) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function TeamRow({ labelA, labelB }: { labelA: string[]; labelB: string[] }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="flex-1 text-right font-medium">{labelA.join(' + ')}</span>
      <span className="text-xs text-slate-400">vs</span>
      <span className="flex-1 font-medium">{labelB.join(' + ')}</span>
    </div>
  );
}

function MatchRow({ m, name }: { m: Match; name: (id: string) => string }) {
  const tone =
    m.state === 'done' ? 'opacity-50' : m.state === 'playing' ? 'border-teal-600 bg-teal-950/40' : '';
  return (
    <div className={`flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 text-sm ${tone}`}>
      <span className="w-6 shrink-0 text-xs text-slate-400">{m.order}</span>
      <span className="flex-1 text-right">{m.teamA.map(name).join(' + ')}</span>
      <span className="w-14 shrink-0 text-center text-xs font-bold text-slate-400">
        {m.scoreA != null && m.scoreB != null ? `${m.scoreA}–${m.scoreB}` : 'vs'}
      </span>
      <span className="flex-1">{m.teamB.map(name).join(' + ')}</span>
    </div>
  );
}

function ScoreSheet({
  match,
  name,
  target,
  onClose,
  onSave,
}: {
  match: Match;
  name: (id: string) => string;
  target: number;
  onClose: () => void;
  onSave: (a: number, b: number) => void;
}) {
  const [a, setA] = useState(target);
  const [b, setB] = useState(0);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg space-y-4 rounded-2xl bg-panel p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-center font-semibold">Trận {match.order}</h2>
        <div className="grid grid-cols-2 gap-3">
          {([[match.teamA, a, setA], [match.teamB, b, setB]] as const).map(([team, val, set], i) => (
            <ScoreBox key={i} label={team.map(name).join(' + ')} value={val} onChange={set} />
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {/* Diem cua ben THUA -> luon nho hon target. */}
          {[...new Set([target - 2, Math.round(target * 0.8), Math.round(target * 0.55), Math.round(target * 0.25), 0])]
            .filter((v) => v >= 0 && v < target)
            .map((v) => (
              <button
                key={v}
                className={`rounded-lg px-3 py-1 text-sm ${b === v ? 'bg-teal-700 text-white' : 'bg-panel2'}`}
                onClick={() => {
                  setA(target);
                  setB(v);
                }}
              >
                thua {v}
              </button>
            ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button disabled={a === b} onClick={() => onSave(a, b)}>
            Lưu & kết thúc
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * O nhap diem: go thang duoc, cham vao la boi den san so cu.
 *
 * Hai cho de sai:
 *  - `draft` cho phep o rong trong luc go (neu ep ve 0 ngay thi xoa xong nhay ve 0).
 *  - fontSize phai dat inline: index.css co `input { font-size: 16px }` khong nam trong
 *    cascade layer nen thang moi utility text-* cua Tailwind.
 */
function ScoreBox({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  // Chi giu duoc trang thai "o rong" trong luc go; moi gia tri khac deu da kep 0..99,
  // nen cai hien tren man hinh luon dung bang cai se duoc luu.
  const [empty, setEmpty] = useState(false);
  return (
    <div className="space-y-2 rounded-xl bg-panel2 p-3 text-center">
      <div className="truncate text-xs text-slate-400">{label}</div>
      <input
        type="number"
        inputMode="numeric"
        value={empty ? '' : String(value)}
        style={{ fontSize: '2.25rem', lineHeight: '2.75rem' }}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const raw = e.target.value;
          setEmpty(raw === '');
          onChange(raw === '' ? 0 : Math.min(99, Math.max(0, Math.trunc(Number(raw)) || 0)));
        }}
        onBlur={() => setEmpty(false)}
        className="w-full rounded-lg border border-line bg-panel px-1 py-1 text-center font-bold outline-none focus:border-teal-600"
      />
      <div className="flex justify-center gap-2">
        <Button variant="subtle" className="w-12 py-2" onClick={() => onChange(Math.max(0, value - 1))}>
          −
        </Button>
        <Button variant="subtle" className="w-12 py-2" onClick={() => onChange(Math.min(99, value + 1))}>
          +
        </Button>
      </div>
    </div>
  );
}
