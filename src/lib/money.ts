import type { Gender, Session } from '../types';

export interface MoneyReport {
  courtCost: number;
  shuttlesUsed: number;
  shuttleCost: number;
  otherCost: number;
  totalCost: number;
  collected: number;
  outstanding: number;
  expected: number;
  profit: number;
  costPerHead: number;
  payingHeads: number;
  /** Muc thu deu dau nguoi de hoa von, lam tron len 5.000. */
  breakEvenFee: number;
}

/** Nu tra it hon nam bao nhieu dong, khi host chua chinh. */
export const DEFAULT_FEMALE_DISCOUNT = 20000;

export type GenderOf = (playerId: string) => Gender | undefined;

const roundUp5k = (v: number) => Math.ceil(v / 5000) * 5000;
const roundDown5k = (v: number) => Math.floor(v / 5000) * 5000;

/** Nguoi 'absent' khong tinh tien; 'left' van tinh vi da choi. */
export function payingAttendees(s: Session) {
  return s.attendees.filter((a) => a.status !== 'absent' && a.status !== 'pending');
}

/** Buoi cu luu truoc khi co tinh nang nay khong co truong nay -> lay mac dinh. */
export function femaleDiscountOf(s: Session): number {
  return Math.max(0, s.femaleDiscount ?? DEFAULT_FEMALE_DISCOUNT);
}

export function computeMoney(s: Session): MoneyReport {
  const hours = s.durationMin / 60;
  const courtCost = Math.round(s.courtCount * hours * s.courtPricePerHour);
  const shuttlesUsed = Math.max(0, s.shuttlesOut - s.shuttlesBack);
  const shuttleCost = shuttlesUsed * s.shuttlePrice;
  const otherCost = s.otherCosts.reduce((t, c) => t + c.amount, 0);
  const totalCost = courtCost + shuttleCost + otherCost;

  const paying = payingAttendees(s);
  const collected = paying.filter((a) => a.paid).reduce((t, a) => t + a.fee, 0);
  const expected = paying.reduce((t, a) => t + a.fee, 0);

  return {
    courtCost,
    shuttlesUsed,
    shuttleCost,
    otherCost,
    totalCost,
    collected,
    outstanding: expected - collected,
    expected,
    profit: expected - totalCost,
    costPerHead: paying.length ? Math.round(totalCost / paying.length) : 0,
    payingHeads: paying.length,
    breakEvenFee: paying.length ? roundUp5k(totalCost / paying.length) : 0,
  };
}

export interface FeePlan {
  /** Muc thu cho nam. */
  male: number;
  /** Muc thu cho nu. Khong bao gio am. */
  female: number;
  /** Chenh lech thuc su ap dung — co the nho hon muc host nhap (xem ghi chu duoi). */
  discount: number;
  /** True khi phai keo chenh lech xuong vi nam khong ganh noi. */
  clamped: boolean;
  males: number;
  females: number;
  /** Tong thu neu ap ke hoach nay. Luon >= chi phi + lai mong muon (do lam tron len). */
  expected: number;
  profit: number;
}

/**
 * Chia muc thu theo gioi: nu tra it hon nam dung `femaleDiscount` dong.
 *
 * Giai he  males*male + females*female = need  voi  male = female + d:
 *   female = (need - males*d) / heads,  male = female + d
 *
 * Lam tron `female` LEN 5.000 roi moi cong d (d da lam tron XUONG 5.000), nen:
 *  - khoang cach nam-nu dung bang d, ca hai deu la boi cua 5.000;
 *  - tong thu luon >= need, khong bao gio hut tien san.
 */
export function feePlan(s: Session, genderOf: GenderOf, targetProfit = 0): FeePlan {
  const need = computeMoney(s).totalCost + targetProfit;
  const paying = payingAttendees(s);
  const heads = paying.length;
  const females = paying.filter((a) => genderOf(a.playerId) === 'F').length;
  const males = heads - females;

  if (!heads) {
    return { male: 0, female: 0, discount: 0, clamped: false, males: 0, females: 0, expected: 0, profit: -need + targetProfit };
  }

  const wanted = femaleDiscountOf(s);
  // Toan nam hoac toan nu: khong co ai de so sanh, thu deu.
  // Con lai: chenh lech khong duoc lon den muc nu phai tra so am (nam ganh het).
  const discount = males === 0 || females === 0 ? 0 : roundDown5k(Math.min(wanted, need / males));
  const female = roundUp5k(Math.max(0, need - males * discount) / heads);
  const male = female + discount;
  const expected = males * male + females * female;

  return {
    male,
    female,
    discount,
    clamped: discount < wanted && males > 0 && females > 0,
    males,
    females,
    expected,
    profit: expected - computeMoney(s).totalCost,
  };
}

/** Muc thu mac dinh cho mot nguoi moi ghi ten, theo gioi tinh. */
export function defaultFeeFor(s: Session, gender: Gender | undefined): number {
  return gender === 'F' ? Math.max(0, s.defaultFee - femaleDiscountOf(s)) : s.defaultFee;
}

/** Muc thu deu dau nguoi de dat duoc muc lai mong muon (khong phan biet gioi). */
export function feeForTargetProfit(s: Session, targetProfit: number): number {
  const heads = payingAttendees(s).length;
  if (!heads) return 0;
  return roundUp5k((computeMoney(s).totalCost + targetProfit) / heads);
}

export const formatVnd = (v: number) => new Intl.NumberFormat('vi-VN').format(Math.round(v)) + 'đ';
