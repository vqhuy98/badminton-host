import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { navigate } from '../App';
import { Banner, IconArrowRight, IconBack, StepBar, toast } from '../components/ui';
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
  // Doi buoi thi quen lua chon cu.
  useEffect(() => setPicked(null), [sessionId]);

  if (!session || !matches) return <div className="p-6 text-slate-400">Đang tải…</div>;

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
    </>
  );
}
