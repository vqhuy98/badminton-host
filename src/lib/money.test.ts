import { describe, expect, it } from 'vitest';
import {
  computeMoney,
  defaultFeeFor,
  DEFAULT_FEMALE_DISCOUNT,
  feeForTargetProfit,
  feePlan,
  femaleDiscountOf,
  splitFees,
  type Payer,
} from './money';
import { DEFAULT_SESSION } from './actions';
import type { Gender, Session } from '../types';

function session(patch: Partial<Session> = {}): Session {
  return { ...DEFAULT_SESSION, id: 's', createdAt: 0, ...patch };
}

const heads = (n: number, paid = false) =>
  Array.from({ length: n }, (_, i) => ({ playerId: `p${i}`, status: 'arrived' as const, fee: 60000, paid }));

describe('tai chinh mot buoi', () => {
  it('tinh dung tien san, cau da dung va lai lo', () => {
    const s = session({
      courtCount: 2,
      durationMin: 120,
      courtPricePerHour: 120000,
      shuttlePrice: 20000,
      shuttlesOut: 12,
      shuttlesBack: 3,
      attendees: heads(14, true),
    });
    const m = computeMoney(s);
    expect(m.courtCost).toBe(480000);       // 2 san * 2h * 120k
    expect(m.shuttlesUsed).toBe(9);          // 12 mang ra - 3 con lai
    expect(m.shuttleCost).toBe(180000);
    expect(m.totalCost).toBe(660000);
    expect(m.expected).toBe(840000);         // 14 * 60k
    expect(m.profit).toBe(180000);
  });

  it('nguoi vang khong bi tinh tien, nguoi ve som van tinh', () => {
    const s = session({
      attendees: [
        { playerId: 'a', status: 'arrived', fee: 60000, paid: true },
        { playerId: 'b', status: 'left', fee: 60000, paid: false },
        { playerId: 'c', status: 'absent', fee: 60000, paid: false },
        { playerId: 'd', status: 'pending', fee: 60000, paid: false },
      ],
    });
    const m = computeMoney(s);
    expect(m.payingHeads).toBe(2);
    expect(m.expected).toBe(120000);
    expect(m.collected).toBe(60000);
    expect(m.outstanding).toBe(60000);
  });

  it('muc thu hoa von lam tron len 5.000', () => {
    const s = session({ courtPricePerHour: 100000, shuttlesOut: 5, shuttlesBack: 0, attendees: heads(13) });
    const m = computeMoney(s);
    expect(m.totalCost).toBe(500000);           // 400k san + 100k cau
    expect(m.costPerHead).toBe(38462);
    expect(m.breakEvenFee).toBe(40000);          // lam tron len 5k
    expect(feeForTargetProfit(s, 200000)).toBe(55000);
  });

  it('khong chia cho 0 khi chua ai toi', () => {
    const m = computeMoney(session());
    expect(m.costPerHead).toBe(0);
    expect(m.breakEvenFee).toBe(0);
  });
});

describe('chia muc thu theo gioi tinh', () => {
  const mixed = (males: number, females: number) => [
    ...Array.from({ length: males }, (_, i) => ({ playerId: `m${i}`, status: 'arrived' as const, fee: 0, paid: false })),
    ...Array.from({ length: females }, (_, i) => ({ playerId: `f${i}`, status: 'arrived' as const, fee: 0, paid: false })),
  ];
  const g = (id: string): Gender => (id.startsWith('f') ? 'F' : 'M');
  /** 2 san * 2h * 120k + 9 qua * 20k = 660k. */
  const s660 = (males: number, females: number, femaleDiscount = 20000) =>
    session({ shuttlesBack: 3, femaleDiscount, attendees: mixed(males, females) });

  it('nu tra it hon nam dung bang muc chenh lech, va van du tien', () => {
    const p = feePlan(s660(9, 5), g);
    expect(p.male - p.female).toBe(20000);
    expect(p.males).toBe(9);
    expect(p.females).toBe(5);
    expect(p.expected).toBeGreaterThanOrEqual(660000);  // khong duoc hut tien san
    expect(p.profit).toBe(p.expected - 660000);
  });

  it('ca hai muc deu la boi cua 5.000', () => {
    for (const [males, females] of [[9, 5], [7, 7], [11, 3], [4, 10]]) {
      const p = feePlan(s660(males, females), g);
      expect(p.male % 5000).toBe(0);
      expect(p.female % 5000).toBe(0);
    }
  });

  it('thu du bu chi voi moi ti le nam/nu', () => {
    for (let females = 0; females <= 14; females++) {
      const p = feePlan(s660(14 - females, females), g);
      expect(p.expected).toBeGreaterThanOrEqual(660000);
      expect(p.female).toBeGreaterThanOrEqual(0);
    }
  });

  it('toan nam hoac toan nu thi thu deu dau nguoi', () => {
    expect(feePlan(s660(14, 0), g)).toMatchObject({ discount: 0, male: 50000, female: 50000 });
    expect(feePlan(s660(0, 14), g)).toMatchObject({ discount: 0, male: 50000, female: 50000 });
  });

  it('it nam qua thi keo muc giam xuong thay vi de nu tra so am', () => {
    // Chi 200k, 2 nam + 6 nu, host dat muc giam 150k: 2 nam khong the ganh noi.
    // Muc giam toi da = 200k / 2 nam = 100k, luc do nu tra 0d.
    const s = session({
      courtPricePerHour: 50000,
      shuttlesOut: 12,
      shuttlesBack: 12,
      femaleDiscount: 150000,
      attendees: mixed(2, 6),
    });
    expect(computeMoney(s).totalCost).toBe(200000);
    const p = feePlan(s, g);
    expect(p.clamped).toBe(true);
    expect(p.discount).toBe(100000);
    expect(p.male).toBe(100000);
    expect(p.female).toBe(0);
    expect(p.expected).toBeGreaterThanOrEqual(200000);
  });

  it('muc lai mong muon cong them vao ca hai gia', () => {
    const s = s660(9, 5);
    const even = feePlan(s, g, 0);
    const lai = feePlan(s, g, 200000);
    expect(lai.male).toBeGreaterThan(even.male);
    expect(lai.male - lai.female).toBe(20000);
    expect(lai.expected).toBeGreaterThanOrEqual(860000);
  });

  it('nguoi moi ghi ten duoc gan dung muc thu theo gioi', () => {
    const s = session({ defaultFee: 70000, femaleDiscount: 20000 });
    expect(defaultFeeFor(s, 'M')).toBe(70000);
    expect(defaultFeeFor(s, 'F')).toBe(50000);
    expect(defaultFeeFor(s, undefined)).toBe(70000);
  });

  it('buoi cu chua co truong nay van co mac dinh', () => {
    const old = session();
    delete (old as Partial<Session>).femaleDiscount;
    expect(femaleDiscountOf(old)).toBe(DEFAULT_FEMALE_DISCOUNT);
  });
});

describe('chia tien theo so tran / thoi gian', () => {
  const s660 = (femaleDiscount = 20000) =>
    session({ shuttlesBack: 3, femaleDiscount, attendees: heads(14) });   // tong chi 660k
  const ai = (n: number, f: (i: number) => Partial<Payer> = () => ({})): Payer[] =>
    Array.from({ length: n }, (_, i) => ({
      playerId: `p${i}`, female: false, matches: 7, minutes: 120, ...f(i),
    }));

  it('chia deu cho ra dung ket qua nhu cach cu', () => {
    const s = s660();
    const nguoi = ai(14, (i) => ({ female: i >= 10 }));   // 10 nam 4 nu
    const moi = splitFees(s, nguoi, 'even');
    const cu = feePlan(s, (id) => (Number(id.slice(1)) >= 10 ? 'F' : 'M'));
    expect(moi.shares.find((x) => !x.female)!.fee).toBe(cu.male);
    expect(moi.shares.find((x) => x.female)!.fee).toBe(cu.female);
  });

  it('danh nhieu tran thi tra nhieu hon', () => {
    const r = splitFees(s660(0), ai(14, (i) => ({ matches: i < 3 ? 5 : 7 })), 'matches');
    const it_ = r.shares.find((x) => x.matches === 5)!.fee;
    const nhieu = r.shares.find((x) => x.matches === 7)!.fee;
    expect(it_).toBeLessThan(nhieu);
    // don gia moi tran phai xap xi nhau — do chenh chi con do lam tron 5k
    expect(Math.abs(it_ / 5 - nhieu / 7)).toBeLessThan(1200);
  });

  it('ve som tra it hon — tinh theo thoi gian co mat', () => {
    const r = splitFees(s660(0), ai(14, (i) => ({ minutes: i < 2 ? 60 : 120 })), 'time');
    expect(r.shares[0].fee).toBeLessThan(r.shares[13].fee);
    expect(r.shares[0].fee / r.shares[13].fee).toBeCloseTo(0.5, 1);
  });

  it('khong bao gio thu hut tien san, o ca ba cach chia', () => {
    for (const mode of ['even', 'matches', 'time'] as const) {
      for (const nu of [0, 1, 4, 7, 13, 14]) {
        const r = splitFees(s660(), ai(14, (i) => ({
          female: i < nu, matches: 4 + (i % 4), minutes: 40 + i * 6,
        })), mode);
        expect(r.expected).toBeGreaterThanOrEqual(660000);
        expect(r.shares.every((x) => x.fee >= 0)).toBe(true);
      }
    }
  });

  it('chua danh tran nao thi tu quay ve chia deu va noi ro', () => {
    const r = splitFees(s660(), ai(14, () => ({ matches: 0 })), 'matches');
    expect(r.fellBack).toBe(true);
    expect(r.mode).toBe('even');
    expect(new Set(r.shares.map((x) => x.fee)).size).toBe(1);
  });

  it('keo muc giam xuong thay vi de nu tra so am', () => {
    // nu danh rat it + muc giam qua lon -> phai tu ha muc giam
    const r = splitFees(s660(500000), ai(14, (i) => ({ female: i === 0, matches: i === 0 ? 1 : 7 })), 'matches');
    expect(r.shares[0].fee).toBeGreaterThanOrEqual(0);
    expect(r.discount).toBeLessThan(500000);
    expect(r.expected).toBeGreaterThanOrEqual(660000);
  });

  it('khong ai thi khong vo', () => {
    expect(splitFees(s660(), [], 'matches').shares).toEqual([]);
  });
});
