import { describe, expect, it } from 'vitest';
import type { Match } from '../types';

/**
 * Logic doi nguoi tach khoi Dexie de test thuan.
 * Giu dung dieu kien cua substitute() trong actions.ts.
 */
function doiNguoi(all: Match[], outId: string, inId: string) {
  const swap = (t: [string, string]): [string, string] =>
    t.map((x) => (x === outId ? inId : x)) as [string, string];
  const before: { id: string; teamA: [string, string]; teamB: [string, string] }[] = [];
  const sau = all.map((m) => {
    if (m.state !== 'queued') return m;
    if (![...m.teamA, ...m.teamB].includes(outId)) return m;
    if ([...m.teamA, ...m.teamB].includes(inId)) return m;
    before.push({ id: m.id, teamA: [...m.teamA] as [string, string], teamB: [...m.teamB] as [string, string] });
    return { ...m, teamA: swap(m.teamA), teamB: swap(m.teamB) };
  });
  return { sau, before, changed: before.length };
}

const hoanTac = (all: Match[], before: ReturnType<typeof doiNguoi>['before']) =>
  all.map((m) => {
    const b = before.find((x) => x.id === m.id);
    return b ? { ...m, teamA: b.teamA, teamB: b.teamB } : m;
  });

const m = (id: string, a: [string, string], b: [string, string], state: Match['state'] = 'queued'): Match => ({
  id, sessionId: 's', order: Number(id.slice(1)), mandatory: true, teamA: a, teamB: b, state,
});

const dem = (ms: Match[]) => {
  const c: Record<string, number> = {};
  ms.forEach((x) => [...x.teamA, ...x.teamB].forEach((p) => (c[p] = (c[p] ?? 0) + 1)));
  return c;
};

describe('doi nguoi trong cac tran chua danh', () => {
  const lich = [
    m('m1', ['A', 'B'], ['C', 'D']),
    m('m2', ['A', 'C'], ['E', 'F']),
    m('m3', ['B', 'E'], ['C', 'F']),          // khong co A
    m('m4', ['A', 'E'], ['C', 'K']),          // K da co san -> phai bo qua khi doi A->K
    m('m5', ['A', 'B'], ['C', 'D'], 'done'),  // da danh -> khong dung toi
    m('m6', ['K', 'B'], ['D', 'F']),          // K da co san, KHONG co A — day la cho lam vo phep goi nguoc
  ];

  it('chi doi o tran chua danh va khong tao ra nguoi trung trong cung tran', () => {
    const r = doiNguoi(lich, 'A', 'K');
    expect(r.changed).toBe(2);                              // m1, m2
    expect(r.sau.find((x) => x.id === 'm4')!.teamA).toEqual(['A', 'E']);   // bo qua vi K da co
    expect(r.sau.find((x) => x.id === 'm5')!.teamA).toEqual(['A', 'B']);   // tran da danh giu nguyen
    r.sau.forEach((x) => {
      const p = [...x.teamA, ...x.teamB];
      expect(new Set(p).size).toBe(4);                      // khong ai bi trung trong mot tran
    });
  });

  it('goi nguoc substitute KHONG phai hoan tac — day la loi da tung gap', () => {
    const doi = doiNguoi(lich, 'A', 'K');
    const nguoc = doiNguoi(doi.sau, 'K', 'A');              // cach hoan tac SAI
    expect(dem(nguoc.sau)).not.toEqual(dem(lich));          // lam hong them, khong tra lai duoc
  });

  it('hoan tac bang ban chup tra lai dung y nguyen', () => {
    const doi = doiNguoi(lich, 'A', 'K');
    expect(hoanTac(doi.sau, doi.before)).toEqual(lich);
  });

  it('hoan tac dung ca khi doi nhieu lan lien tiep', () => {
    const b1 = doiNguoi(lich, 'A', 'K');
    const b2 = doiNguoi(b1.sau, 'B', 'Z');
    expect(hoanTac(hoanTac(b2.sau, b2.before), b1.before)).toEqual(lich);
  });

  it('khong co tran nao hop le thi khong doi gi', () => {
    const r = doiNguoi([m('m9', ['X', 'Y'], ['Z', 'W'], 'done')], 'X', 'Q');
    expect(r.changed).toBe(0);
    expect(r.before).toEqual([]);
  });
});
