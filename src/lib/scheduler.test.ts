import { describe, expect, it } from 'vitest';
import { generateSchedule, planShape, type SchedPlayer } from './scheduler';
import { LEVELS, type Gender } from '../types';

const RATINGS = [1300, 1500, 1200, 1400, 1100, 1300, 1600, 1250, 1350, 1450, 1200, 1100, 1300, 1150];

function makePlayers(n: number): SchedPlayer[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    rating: RATINGS[i % RATINGS.length],
    gender: (i % 7 === 3 ? 'F' : 'M') as Gender,
  }));
}

/** Dem so tran cua tung nguoi trong k tran dau tien. */
function countsAfter(result: ReturnType<typeof generateSchedule>, k: number) {
  const c = new Map<string, number>();
  for (const m of result.matches.slice(0, k)) {
    for (const id of [...m.teamA, ...m.teamB]) c.set(id, (c.get(id) ?? 0) + 1);
  }
  return c;
}

function gapViolations(result: ReturnType<typeof generateSchedule>, gap: number) {
  const last = new Map<string, number>();
  let bad = 0;
  result.matches.forEach((m, i) => {
    for (const id of [...m.teamA, ...m.teamB]) {
      if (i - (last.get(id) ?? -999) < gap) bad++;
      last.set(id, i);
    }
  });
  return bad;
}

describe('14 nguoi / 2 san / toi thieu 6 toi da 7', () => {
  const players = makePlayers(14);
  const opts = { minPer: 6, maxPer: 7, courtCount: 2 };
  const shape = planShape(players, opts);
  const res = generateSchedule(players, { ...opts, iterations: 20000 });

  it('chia thanh 21 tran bat buoc + 3 tran thuong', () => {
    expect(shape.coreCount).toBe(21);
    expect(shape.totalCount).toBe(24);
    expect(res.matches.filter((m) => m.mandatory)).toHaveLength(21);
  });

  it('gap = 3 -> khong ai danh 2 tran lien tiep', () => {
    expect(shape.gap).toBe(3);
    expect(shape.backToBackUnavoidable).toBe(false);
    expect(gapViolations(res, 3)).toBe(0);
  });

  it('tai vach: ca 14 nguoi dung 6 tran', () => {
    const c = countsAfter(res, 21);
    expect(c.size).toBe(14);
    expect([...c.values()].every((v) => v === 6)).toBe(true);
  });

  it('het lich: min 6, max 7, dung 2 nguoi bi thiet', () => {
    const c = countsAfter(res, 24);
    const v = [...c.values()];
    expect(Math.min(...v)).toBe(6);
    expect(Math.max(...v)).toBe(7);
    expect(v.filter((x) => x === 6)).toHaveLength(2);
    expect(res.shortChanged).toHaveLength(2);
  });

  it('dung o bat ky tran nao tu vach tro di deu nam trong 6-7', () => {
    for (let k = 21; k <= 24; k++) {
      const v = [...countsAfter(res, k).values()];
      expect(Math.min(...v)).toBeGreaterThanOrEqual(6);
      expect(Math.max(...v)).toBeLessThanOrEqual(7);
    }
  });

  it('cap danh du can: lech trinh trung binh duoi 1 bac trinh', () => {
    const oneLevelStep = LEVELS.TB - LEVELS['TB-'];
    expect(res.stats.avgImbalance).toBeLessThan(oneLevelStep);
    expect(gapViolations(res, 3)).toBe(0);
  });
});

describe('so nguoi khac', () => {
  it('12 nguoi van giu duoc gap 3', () => {
    const s = planShape(makePlayers(12), { minPer: 6, maxPer: 7, courtCount: 2 });
    expect(s.coreCount).toBe(18);
    expect(s.totalCount).toBe(21);
    expect(s.backToBackUnavoidable).toBe(false);
  });

  it('10 nguoi / 2 san: canh bao khong tranh duoc 2 tran lien tiep', () => {
    const s = planShape(makePlayers(10), { minPer: 6, maxPer: 7, courtCount: 2 });
    expect(s.gap).toBe(2);
    expect(s.backToBackUnavoidable).toBe(true);
  });

  it('13 nguoi: lich van hop le du 13*6 khong chia het cho 4', () => {
    const players = makePlayers(13);
    const opts = { minPer: 6, maxPer: 7, courtCount: 2 };
    const res = generateSchedule(players, { ...opts, iterations: 8000 });
    const v = [...countsAfter(res, res.shape.coreCount).values()];
    expect(Math.min(...v)).toBeGreaterThanOrEqual(6);
    expect(gapViolations(res, res.shape.gap)).toBe(0);
  });
});
