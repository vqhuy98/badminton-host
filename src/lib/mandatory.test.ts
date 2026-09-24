import { describe, expect, it } from 'vitest';
import { mandatoryBoundary } from './actions';

/** Sinh lich gia: moi tran 4 nguoi, xoay vong deu. */
function rota(names: string[], matches: number): string[][] {
  const out: string[][] = [];
  let k = 0;
  for (let i = 0; i < matches; i++) {
    const m: string[] = [];
    while (m.length < 4) {
      const p = names[k % names.length];
      k++;
      if (!m.includes(p)) m.push(p);
    }
    out.push(m);
  }
  return out;
}

describe('vach 6 tran', () => {
  it('14 nguoi / 21 tran -> vach dung o tran 21', () => {
    const names = Array.from({ length: 14 }, (_, i) => `p${i}`);
    const r = rota(names, 21);
    expect(mandatoryBoundary(r, new Set(names), 6)).toBe(21);
  });

  it('them nguoi thu 15 giua buoi -> vach phai LUI XUONG, khong duoc dung im', () => {
    const names = Array.from({ length: 15 }, (_, i) => `p${i}`);
    const r = rota(names, 24);
    const vach = mandatoryBoundary(r, new Set(names), 6);
    expect(vach).toBeGreaterThan(21);
    // Tai vach moi, moi nguoi phai that su du 6 tran.
    const seen = new Map<string, number>();
    for (const m of r.slice(0, vach)) for (const id of m) seen.set(id, (seen.get(id) ?? 0) + 1);
    expect(Math.min(...names.map((n) => seen.get(n) ?? 0))).toBeGreaterThanOrEqual(6);
  });

  it('nguoi da ve khong keo vach di xa', () => {
    const names = Array.from({ length: 15 }, (_, i) => `p${i}`);
    const r = rota(names, 24);
    const active = new Set(names.slice(0, 12)); // 3 nguoi ve som
    expect(mandatoryBoundary(r, active, 6)).toBeLessThan(mandatoryBoundary(r, new Set(names), 6));
  });

  it('khong ai dat noi minPer -> vach o cuoi lich thay vi bao dai', () => {
    const names = Array.from({ length: 20 }, (_, i) => `p${i}`);
    const r = rota(names, 10); // 40 suat cho 20 nguoi -> toi da 2 tran/nguoi
    expect(mandatoryBoundary(r, new Set(names), 6)).toBe(10);
  });
});
