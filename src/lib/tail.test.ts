import { describe, expect, it } from 'vitest';
import { buildTail, generateSchedule, planShape, type SchedPlayer } from './scheduler';
import type { Gender } from '../types';

const mk = (n: number, from = 0): SchedPlayer[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i + from}`,
    rating: 1100 + ((i * 97) % 500),
    gender: ((i + from) % 5 === 4 ? 'F' : 'M') as Gender,
  }));

/** Dung lich that cho 14 nguoi roi coi 4 tran dau da danh xong. */
function startedSession() {
  const players = mk(14);
  const opts = { minPer: 6, maxPer: 7, courtCount: 2 };
  const shape = planShape(players, opts);
  const res = generateSchedule(players, { ...opts, iterations: 6000 });
  const index = new Map(players.map((p, i) => [p.id, i]));
  const rosters = res.matches.map((m) => [...m.teamA, ...m.teamB].map((id) => index.get(id)!));
  return { players, shape, rosters, index };
}

function gapViolations(rosters: number[][], gap: number) {
  const last = new Map<number, number>();
  let bad = 0;
  rosters.forEach((m, i) => {
    for (const p of m) {
      if (i - (last.get(p) ?? -999) < gap) bad++;
      last.set(p, i);
    }
  });
  return bad;
}

const countOf = (rosters: number[][]) => {
  const c = new Map<number, number>();
  for (const m of rosters) for (const p of m) c.set(p, (c.get(p) ?? 0) + 1);
  return c;
};

describe('co nguoi moi toi giua buoi', () => {
  const { players, shape, rosters } = startedSession();
  const PLAYED = 4;
  const frozen = rosters.slice(0, PLAYED);
  const withNewcomer = [...players, ...mk(1, 14)]; // p14 toi muon

  const res = buildTail({
    players: withNewcomer,
    frozen,
    tailCount: rosters.length - PLAYED,
    gap: shape.gap,
    minPer: 6,
    maxPer: 7,
  });

  it('nguoi moi duoc chen vao lich con lai', () => {
    const c = countOf(res.tail);
    expect(c.get(14) ?? 0).toBeGreaterThan(0);
  });

  it('khong pha khoang cach, ke ca chO giap ranh voi tran da danh', () => {
    expect(gapViolations([...frozen, ...res.tail], shape.gap)).toBe(0);
  });

  it('khong ai vuot qua maxPer', () => {
    const c = countOf([...frozen, ...res.tail]);
    expect(Math.max(...c.values())).toBeLessThanOrEqual(7);
  });

  it('nguoi moi toi lam ca nhom khong con du suat -> bao ro thay vi im lang', () => {
    // 15 nguoi x 6 tran = 90 suat, ma chi con 20 tran x 4 = 80 suat + 16 da danh.
    const total = countOf([...frozen, ...res.tail]);
    const short = withNewcomer.filter((_, i) => (total.get(i) ?? 0) < 6).length;
    if (short > 0) expect(res.unmetNeed).toBeGreaterThan(0);
    else expect(res.unmetNeed).toBe(0);
  });
});

describe('co nguoi ve giua buoi', () => {
  const { players, shape, rosters } = startedSession();
  const PLAYED = 6;
  const frozen = rosters.slice(0, PLAYED);
  const active = players.map((_, i) => i !== 3 && i !== 7); // 2 nguoi ve som

  const res = buildTail({
    players,
    frozen,
    tailCount: rosters.length - PLAYED,
    gap: shape.gap,
    minPer: 6,
    maxPer: 7,
    active,
  });

  it('nguoi da ve khong bi xep them tran nao', () => {
    const c = countOf(res.tail);
    expect(c.get(3) ?? 0).toBe(0);
    expect(c.get(7) ?? 0).toBe(0);
  });

  it('khoang cach van sach', () => {
    expect(gapViolations([...frozen, ...res.tail], shape.gap)).toBe(0);
  });

  it('it nguoi di -> co the phai bot tran cuoi thay vi xep bua', () => {
    expect(res.usableTail).toBeLessThanOrEqual(rosters.length - PLAYED);
    expect(res.tail.length).toBe(res.usableTail);
  });
});
