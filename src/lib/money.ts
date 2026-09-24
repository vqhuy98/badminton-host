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

export type FeeMode = 'even' | 'matches' | 'time';

export const FEE_MODE_LABEL: Record<FeeMode, string> = {
  even: 'Chia đều',
  matches: 'Theo số trận',
  time: 'Theo thời gian có mặt',
};

export interface Payer {
  playerId: string;
  female: boolean;
  /** So tran da danh. */
  matches: number;
  /** So phut co mat tai san. */
  minutes: number;
}

export interface FeeShare extends Payer {
  /** Trong so dung de chia (1 / so tran / so phut). */
  weight: number;
  fee: number;
}

export interface FeeSplit {
  mode: FeeMode;
  shares: FeeShare[];
  /** Muc giam cho nu thuc su ap dung. */
  discount: number;
  clamped: boolean;
  /** Da quay ve chia deu vi khong ai co so lieu (chua danh tran nao). */
  fellBack: boolean;
  expected: number;
  profit: number;
}

/**
 * Chia tien cho tung nguoi theo mot trong ba cach, van giu muc giam cho nu.
 *
 *   phi_i = lam_tron_len_5k( base * w_i  -  (nu ? d : 0) )
 *   base  = (can_thu + so_nu * d) / tong_w
 *
 * Voi 'even' thi moi w_i = 1 nen ket qua trung khop voi cach chia cu.
 *
 * Muc giam d bi chan de khong nguoi nu nao phai tra so am. Dieu kien
 * base * w_min >= d, thay base vao va rut gon duoc:
 *   d <= can_thu * w_min / (tong_w - so_nu * w_min)
 */
export function splitFees(s: Session, people: Payer[], mode: FeeMode, targetProfit = 0): FeeSplit {
  const need = computeMoney(s).totalCost + targetProfit;
  const rong: FeeSplit = {
    mode, shares: [], discount: 0, clamped: false, fellBack: false,
    expected: 0, profit: -computeMoney(s).totalCost,
  };
  if (!people.length) return rong;

  const raw = (p: Payer) =>
    mode === 'matches' ? Math.max(0, p.matches) : mode === 'time' ? Math.max(0, p.minutes) : 1;

  let w = people.map(raw);
  // Chua ai danh tran nao / chua ghi gio -> chia deu, va noi ro la da quay ve.
  const fellBack = w.every((x) => x <= 0);
  if (fellBack) w = people.map(() => 1);

  const sumW = w.reduce((a, b) => a + b, 0);
  const females = people.filter((p) => p.female).length;
  const males = people.length - females;

  let d = 0;
  if (males > 0 && females > 0) {
    const wMinNu = Math.min(...people.map((p, i) => (p.female ? w[i] : Infinity)));
    const mau = sumW - females * wMinNu;
    const tran = mau > 0 ? (need * wMinNu) / mau : femaleDiscountOf(s);
    d = roundDown5k(Math.max(0, Math.min(femaleDiscountOf(s), tran)));
  }

  const base = (need + females * d) / sumW;
  const shares: FeeShare[] = people.map((p, i) => ({
    ...p,
    weight: w[i],
    fee: Math.max(0, roundUp5k(base * w[i] - (p.female ? d : 0))),
  }));
  const expected = shares.reduce((t, x) => t + x.fee, 0);

  return {
    mode: fellBack ? 'even' : mode,
    shares,
    discount: d,
    clamped: d < femaleDiscountOf(s) && males > 0 && females > 0,
    fellBack,
    expected,
    profit: expected - computeMoney(s).totalCost,
  };
}
