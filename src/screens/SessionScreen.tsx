import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { navigate } from '../App';
import { db } from '../db';
import SetupTab from './SetupTab';
import RosterTab from './RosterTab';
import CourtTab from './CourtTab';
import MoneyTab from './MoneyTab';

const TABS = [
  { key: 'setup', label: 'Buổi' },
  { key: 'roster', label: 'Người' },
  { key: 'court', label: 'Sân' },
  { key: 'money', label: 'Tiền' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export default function SessionScreen({ sessionId }: { sessionId: string }) {
  const [tab, setTab] = useState<TabKey>('setup');
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId]);

  if (!session) return <div className="p-6 text-slate-400">Đang tải…</div>;

  return (
    <>
      <div className="flex items-center gap-3 p-4 pb-2">
        <button onClick={() => navigate({ name: 'home' })} className="text-2xl leading-none text-slate-400">
          ‹
        </button>
        <div className="min-w-0">
          <div className="truncate font-semibold">{session.venue || 'Buổi mới'}</div>
          <div className="text-xs text-slate-400">
            {session.date} · {session.courtCount} sân · {session.durationMin}′
          </div>
        </div>
      </div>

      <div className="px-4">
        {tab === 'setup' && <SetupTab session={session} />}
        {tab === 'roster' && <RosterTab session={session} />}
        {tab === 'court' && <CourtTab session={session} />}
        {tab === 'money' && <MoneyTab session={session} />}
      </div>

      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-lg border-t border-line bg-panel/95 backdrop-blur">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-4 text-sm font-semibold ${
              tab === t.key ? 'text-teal-300' : 'text-slate-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </>
  );
}
