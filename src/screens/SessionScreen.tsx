import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { navigate } from '../App';
import { getHostSettings } from '../db';
import { bankByBin } from '../lib/banks';
import { computeMoney, payingAttendees } from '../lib/money';
import type { ShareData } from '../lib/share';
import ShareSheet from './ShareSheet';
import { Banner, IconArrowRight, IconBack, IconButton, StepBar, toast } from '../components/ui';
import { db } from '../db';
import { sessionProgress, type StepKey } from '../lib/progress';
import SetupTab from './SetupTab';
import RosterTab from './RosterTab';
import CourtTab from './CourtTab';
import MoneyTab from './MoneyTab';

export default function SessionScreen({ sessionId }: { sessionId: string }) {
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId]);
  const matches = useLiveQuery(
    () => db.matches.where('sessionId').equals(sessionId).toArray(),
    [sessionId],
  );
  // null = chua chon tay -> bam theo buoc app goi y. Chon roi thi ton trong lua chon.
  const [picked, setPicked] = useState<StepKey | null>(null);
  const [sharing, setSharing] = useState(false);
  const players = useLiveQuery(() => db.players.toArray(), []) ?? [];
  const host = useLiveQuery(() => getHostSettings(), []);
  // Doi buoi thi quen lua chon cu.
  useEffect(() => setPicked(null), [sessionId]);

  if (!session || !matches) return <div className="p-6 text-slate-400">Đang tải…</div>;

  const byId = new Map(players.map((p) => [p.id, p]));
  const ten = (id: string) => byId.get(id)?.name ?? '?';
  const demTran = new Map<string, number>();
  matches.filter((x) => x.state === 'done')
    .forEach((x) => [...x.teamA, ...x.teamB].forEach((id) => demTran.set(id, (demTran.get(id) ?? 0) + 1)));
  const tien = computeMoney(session);
  const shareData: ShareData = {
    session,
    rows: payingAttendees(session).map((a) => ({
      name: ten(a.playerId),
      female: byId.get(a.playerId)?.gender === 'F',
      matches: demTran.get(a.playerId) ?? 0,
      fee: a.fee,
      paid: a.paid,
    })),
    matches: [...matches].sort((a, b) => a.order - b.order).map((mm) => ({
      order: mm.order, a: mm.teamA.map(ten).join(' + '), b: mm.teamB.map(ten).join(' + '),
      scoreA: mm.scoreA, scoreB: mm.scoreB,
    })),
    bank: host?.bankBin && host?.accountNumber
      ? { bank: bankByBin(host.bankBin)?.ten ?? '?', account: host.accountNumber, holder: host.accountName }
      : undefined,
    totals: { cost: tien.totalCost, expected: tien.expected, collected: tien.collected, profit: tien.profit },
  };

  const prog = sessionProgress(session, matches);
  const step: StepKey = picked ?? prog.current;
  const stepInfo = prog.steps.find((s) => s.key === step)!;

  function onPick(key: string) {
    const s = prog.steps.find((x) => x.key === key)!;
    if (s.locked) {
      toast(s.lockReason ?? 'Bước này chưa mở.', { tone: 'warn' });
      return;
    }
    setPicked(key as StepKey);
  }

  return (
    <>
      <div className="flex items-center gap-1 p-4 pb-2">
        <button onClick={() => navigate({ name: 'home' })} aria-label="Về trang chủ"
                className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-300 active:bg-panel2">
          <IconBack />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{session.venue || 'Buổi chưa đặt tên'}</div>
          <div className="text-xs text-slate-400">
            {session.date} · {session.courtCount} sân · {session.durationMin}′
          </div>
        </div>
        <IconButton label="Gửi lên Zalo" onClick={() => setSharing(true)}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
          </svg>
        </IconButton>
      </div>

      <div className="space-y-4 px-4 pb-4">
        {/* Viec tiep theo — luon la mot viec duy nhat, bam la nhay dung buoc. */}
        {prog.next && prog.next.step !== step && (
          <button onClick={() => setPicked(prog.next!.step)}
            className="flex w-full items-center gap-3 rounded-2xl border border-teal-700 bg-teal-950/50 px-4 py-3 text-left active:bg-teal-900/50">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-teal-400/80">Việc tiếp theo</div>
              <div className="truncate font-semibold text-teal-100">{prog.next.label}</div>
            </div>
            <IconArrowRight className="h-5 w-5 shrink-0 text-teal-300" />
          </button>
        )}

        {stepInfo.locked ? (
          <Banner level="info">{stepInfo.lockReason}</Banner>
        ) : (
          <>
            {step === 'setup' && <SetupTab session={session} />}
            {step === 'roster' && <RosterTab session={session} />}
            {step === 'court' && <CourtTab session={session} />}
            {step === 'money' && <MoneyTab session={session} />}
          </>
        )}
      </div>

      <StepBar steps={prog.steps} active={step} onPick={onPick} />

      {sharing && <ShareSheet data={shareData} onClose={() => setSharing(false)} />}
    </>
  );
}
