import { describe, expect, it } from 'vitest';
import { computePacing } from './pacing';
import { DEFAULT_SESSION } from './actions';
import type { Match, Session } from '../types';

const s: Session = { ...DEFAULT_SESSION, id: 's', createdAt: 0, startAt: 0, courtCount: 2, durationMin: 120 };
const m = (i: number, mins?: number): Match => ({
  id: `m${i}`, sessionId: 's', order: i, mandatory: i <= 21,
  teamA: ['a', 'b'], teamB: ['c', 'd'],
  state: mins == null ? 'queued' : 'done',
  ...(mins == null ? {} : { startedAt: 0, endedAt: mins * 60_000 }),
});

describe('dong ho tien do', () => {
  const all = Array.from({ length: 24 }, (_, i) => m(i + 1));

  it('chua tran nao xong -> khong canh bao suong, chi bao muc can dat', () => {
    const p = computePacing(s, all, 21, 0);
    expect(p.hasData).toBe(false);
    expect(p.level).toBe('info');
    expect(p.requiredMinPerMatch).toBeCloseTo(11.43, 1);
  });

  it('dung toc do yeu cau o phut 0 phai chieu ra du coreCount, khong bi lam tron thieu', () => {
    const p = computePacing(s, all, 21, 1000);
    expect(p.projectedTotal).toBeGreaterThanOrEqual(21);
    expect(p.shortfallMatches).toBe(0);
  });

  it('danh cham 16 ph/tran -> bao thieu tran so voi vach', () => {
    const played = [m(1, 16), m(2, 16), ...all.slice(2)];
    const p = computePacing(s, played, 21, 16 * 60_000);
    expect(p.hasData).toBe(true);
    expect(p.actualMinPerMatch).toBeCloseTo(16, 1);
    expect(p.shortfallMatches).toBeGreaterThan(0);
    expect(['warn', 'danger']).toContain(p.level);
  });

  it('danh nhanh 10 ph/tran -> kip het ca tran thuong', () => {
    const played = [m(1, 10), m(2, 10), ...all.slice(2)];
    const p = computePacing(s, played, 21, 10 * 60_000);
    expect(p.level).toBe('ok');
    expect(p.projectedTotal).toBe(24);
  });
});
