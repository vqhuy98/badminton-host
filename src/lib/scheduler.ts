import type { Gender } from '../types';

export interface SchedPlayer {
  id: string;
  rating: number;
  gender: Gender;
  /** Uu tien nhan tran thuong (buoi truoc bi thiet). */
  owedBonus?: boolean;
}

export interface Weights {
  imbalance: number;
  partnerRepeat: number;
  opponentRepeat: number;
  genderSplit: number;
  mixedBonus: number;
}

export const DEFAULT_WEIGHTS: Weights = {
  imbalance: 1,
  partnerRepeat: 60,
  opponentRepeat: 20,
  genderSplit: 80,
  mixedBonus: 40,
};

export interface PlanShape {
  n: number;
  /** So tran truoc vach: danh het la ai cung du minPer. */
  coreCount: number;
  /** So tran toi da, khong ai vuot maxPer. */
  totalCount: number;
  /** Khoang cach toi thieu giua 2 tran cua cung 1 nguoi. */
  gap: number;
  /** True khi so nguoi qua it -> khong the tranh danh 2 tran lien tiep. */
  backToBackUnavoidable: boolean;
  /** Quota tung nguoi tinh den vach, theo thu tu uu tien. */
  coreQuota: number[];
  totalQuota: number[];
}

export interface PlannedMatch {
  order: number;
  mandatory: boolean;
  teamA: [string, string];
  teamB: [string, string];
}

export interface SchedResult {
  shape: PlanShape;
  matches: PlannedMatch[];
  /** Nguoi chi duoc minPer tran vi tong cho khong chia het. */
  shortChanged: string[];
  stats: {
    avgImbalance: number;
    maxImbalance: number;
    partnerRepeats: number;
    opponentRepeats3Plus: number;
    gapViolations: number;
  };
}

/** PRNG co seed -> lich sinh ra lap lai duoc, tien cho viec bao loi. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Trong doi, nguoi manh ganh nhieu hon -> khong dung trung binh cong. */
export function teamStrength(r1: number, r2: number): number {
  return 0.6 * Math.max(r1, r2) + 0.4 * Math.min(r1, r2);
}

/**
 * Tinh hinh dang cua lich truoc khi sinh: bao nhieu tran bat buoc, bao nhieu tran thuong,
 * va quota cua tung nguoi. Day la phan tra loi cau hoi "moi nguoi duoc may tran".
 */
export function planShape(
  players: SchedPlayer[],
  opts: { minPer: number; maxPer: number; courtCount: number },
): PlanShape {
  const n = players.length;
  const { minPer, maxPer, courtCount } = opts;
  const coreCount = Math.ceil((n * minPer) / 4);
  const totalCount = Math.max(coreCount, Math.floor((n * maxPer) / 4));

  // Khong the xep 1 nguoi vao 2 tran chay song song -> gap toi thieu = so san.
  // Muon khong ai danh 2 tran lien tiep -> gap = so san + 1.
  const maxFeasibleGap = Math.floor(n / 4);
  const gap = Math.max(1, Math.min(courtCount + 1, maxFeasibleGap));

  const order = [...players.keys()].sort((a, b) => {
    const oa = players[a].owedBonus ? 0 : 1;
    const ob = players[b].owedBonus ? 0 : 1;
    return oa - ob || a - b;
  });

  const quota = (slots: number) => {
    const base = Math.floor(slots / n);
    const rem = slots % n;
    const q = new Array<number>(n).fill(base);
    for (let i = 0; i < rem; i++) q[order[i]] = base + 1;
    return q;
  };

  return {
    n,
    coreCount,
    totalCount,
    gap,
    backToBackUnavoidable: gap <= courtCount,
    coreQuota: quota(coreCount * 4),
    totalQuota: quota(totalCount * 4),
  };
}

/** Pha 1: sinh danh sach 4 nguoi cho tung tran, ton trong quota va khoang cach. */
function buildRosters(shape: PlanShape, seed: number): number[][] | null {
  const { n, coreCount, totalCount, gap, coreQuota, totalQuota } = shape;
  const rnd = mulberry32(seed);
  const last = new Array<number>(n).fill(-999);
  const used = new Array<number>(n).fill(0);
  const rosters: number[][] = [];

  for (let i = 0; i < totalCount; i++) {
    const cap = i < coreCount ? coreQuota : totalQuota;
    const avail: number[] = [];
    for (let p = 0; p < n; p++) {
      if (i - last[p] >= gap && used[p] < cap[p]) avail.push(p);
    }
    if (avail.length < 4) return null;
    const jitter = avail.map(() => rnd());
    avail.sort((a, b) => {
      const da = cap[a] - used[a];
      const db = cap[b] - used[b];
      return db - da || last[a] - last[b] || jitter[avail.indexOf(a)] - jitter[avail.indexOf(b)];
    });
    const pick = avail.slice(0, 4);
    for (const p of pick) {
      last[p] = i;
      used[p] += 1;
    }
    rosters.push(pick);
  }
  for (let p = 0; p < n; p++) if (used[p] !== totalQuota[p]) return null;
  return rosters;
}

/** So tran cua tung nguoi trong `count` tran dau tien. */
function coreCounts(rosters: number[][], n: number, count: number): number[] {
  const c = new Array<number>(n).fill(0);
  for (let i = 0; i < Math.min(count, rosters.length); i++) for (const p of rosters[i]) c[p] += 1;
  return c;
}

/**
 * Rang buoc cung: khong trung nguoi trong 1 tran, du khoang cach, va (neu yeu cau)
 * giu nguyen so tran cua tung nguoi tinh den vach.
 */
function isValid(
  rosters: number[][],
  opts: { n: number; gap: number; coreCount?: number; requireCore?: number[] },
): boolean {
  const { n, gap } = opts;
  const last = new Array<number>(n).fill(-999);
  for (let i = 0; i < rosters.length; i++) {
    const m = rosters[i];
    if (new Set(m).size !== 4) return false;
    for (const p of m) {
      if (i - last[p] < gap) return false;
      last[p] = i;
    }
  }
  if (opts.requireCore && opts.coreCount != null) {
    const c = coreCounts(rosters, n, opts.coreCount);
    for (let p = 0; p < n; p++) if (c[p] !== opts.requireCore[p]) return false;
  }
  return true;
}

type Split = { a: [number, number]; b: [number, number]; cost: number };

function bestSplit(
  m: number[],
  players: SchedPlayer[],
  partner: Map<string, number>,
  opp: Map<string, number>,
  w: Weights,
): Split {
  const key = (x: number, y: number) => (x < y ? `${x}-${y}` : `${y}-${x}`);
  const pairings: [number, number][] = [
    [0, 1],
    [0, 2],
    [0, 3],
  ];
  let best: Split | null = null;
  for (const [i, j] of pairings) {
    const a: [number, number] = [m[i], m[j]];
    const b = m.filter((p) => p !== a[0] && p !== a[1]) as [number, number];
    const sa = teamStrength(players[a[0]].rating, players[a[1]].rating);
    const sb = teamStrength(players[b[0]].rating, players[b[1]].rating);
    let cost = w.imbalance * Math.abs(sa - sb);
    const pa = partner.get(key(a[0], a[1])) ?? 0;
    const pb = partner.get(key(b[0], b[1])) ?? 0;
    cost += w.partnerRepeat * (pa * pa + pb * pb);
    for (const x of a) for (const y of b) cost += w.opponentRepeat * (opp.get(key(x, y)) ?? 0);
    const nf = (t: [number, number]) => t.filter((p) => players[p].gender === 'F').length;
    const fa = nf(a);
    const fb = nf(b);
    if ((fa === 2 && fb === 0) || (fb === 2 && fa === 0)) cost += w.genderSplit;
    if (fa === 1 && fb === 1) cost -= w.mixedBonus;
    if (!best || cost < best.cost) best = { a, b, cost };
  }
  return best!;
}

/** Cham diem ca lich: chia doi tung tran theo thu tu, cong don lich su cap dau. */
function scoreSchedule(rosters: number[][], players: SchedPlayer[], w: Weights) {
  const key = (x: number, y: number) => (x < y ? `${x}-${y}` : `${y}-${x}`);
  const partner = new Map<string, number>();
  const opp = new Map<string, number>();
  const splits: Split[] = [];
  let total = 0;
  for (const m of rosters) {
    const s = bestSplit(m, players, partner, opp, w);
    total += s.cost;
    splits.push(s);
    for (const t of [s.a, s.b]) {
      const k = key(t[0], t[1]);
      partner.set(k, (partner.get(k) ?? 0) + 1);
    }
    for (const x of s.a) for (const y of s.b) {
      const k = key(x, y);
      opp.set(k, (opp.get(k) ?? 0) + 1);
    }
  }
  return { total, splits, partner, opp };
}

export interface GenerateOptions {
  minPer: number;
  maxPer: number;
  courtCount: number;
  weights?: Weights;
  iterations?: number;
  seed?: number;
}

export function generateSchedule(players: SchedPlayer[], opts: GenerateOptions): SchedResult {
  if (players.length < 4) throw new Error('Can it nhat 4 nguoi de xep lich.');
  const w = opts.weights ?? DEFAULT_WEIGHTS;
  const shape = planShape(players, opts);

  let rosters: number[][] | null = null;
  const seed0 = opts.seed ?? 1;
  for (let s = 0; s < 4000 && !rosters; s++) rosters = buildRosters(shape, seed0 + s);
  if (!rosters) throw new Error('Khong sinh duoc lich voi rang buoc hien tai. Thu giam so tran toi thieu.');

  // Pha 2: local search, chi nhan hoan doi vua hop le vua giam chi phi.
  const rnd = mulberry32(seed0 + 9999);
  let best = rosters.map((m) => [...m]);
  let bestCost = scoreSchedule(best, players, w).total;
  const iters = opts.iterations ?? 30000;
  for (let it = 0; it < iters; it++) {
    const i = Math.floor(rnd() * best.length);
    const j = Math.floor(rnd() * best.length);
    if (i === j) continue;
    const cand = best.map((m) => [...m]);
    const a = Math.floor(rnd() * 4);
    const b = Math.floor(rnd() * 4);
    const tmp = cand[i][a];
    cand[i][a] = cand[j][b];
    cand[j][b] = tmp;
    if (!isValid(cand, { n: shape.n, gap: shape.gap, coreCount: shape.coreCount, requireCore: shape.coreQuota }))
      continue;
    const c = scoreSchedule(cand, players, w).total;
    if (c < bestCost) {
      best = cand;
      bestCost = c;
    }
  }

  const { splits, partner, opp } = scoreSchedule(best, players, w);
  const matches: PlannedMatch[] = splits.map((s, i) => ({
    order: i + 1,
    mandatory: i < shape.coreCount,
    teamA: [players[s.a[0]].id, players[s.a[1]].id],
    teamB: [players[s.b[0]].id, players[s.b[1]].id],
  }));

  const imbalances = splits.map((s) =>
    Math.abs(
      teamStrength(players[s.a[0]].rating, players[s.a[1]].rating) -
        teamStrength(players[s.b[0]].rating, players[s.b[1]].rating),
    ),
  );
  const shortChanged = players
    .filter((_, idx) => shape.totalQuota[idx] === opts.minPer)
    .map((p) => p.id);

  return {
    shape,
    matches,
    shortChanged,
    stats: {
      avgImbalance: imbalances.reduce((x, y) => x + y, 0) / (imbalances.length || 1),
      maxImbalance: Math.max(0, ...imbalances),
      partnerRepeats: [...partner.values()].filter((v) => v > 1).length,
      opponentRepeats3Plus: [...opp.values()].filter((v) => v > 2).length,
      gapViolations: isValid(best, { n: shape.n, gap: shape.gap }) ? 0 : 1,
    },
  };
}

/**
 * Can lai cac tran CHUA danh sau khi rating thay doi giua buoi.
 * Giu nguyen so tran cua tung nguoi (ca tong lan tinh den vach) -> khong ai bi mat suat.
 */
export function rebalanceRemaining(
  players: SchedPlayer[],
  rosters: number[][],
  frozenCount: number,
  shape: PlanShape,
  opts: { weights?: Weights; iterations?: number; seed?: number } = {},
): PlannedMatch[] {
  const w = opts.weights ?? DEFAULT_WEIGHTS;
  const rnd = mulberry32(opts.seed ?? 4242);
  const n = players.length;
  // Chot theo lich HIEN TAI, khong theo shape goc: doi hinh co the da doi giua buoi.
  const requireCore = coreCounts(rosters, n, shape.coreCount);
  let best = rosters.map((m) => [...m]);
  let bestCost = scoreSchedule(best, players, w).total;
  const iters = opts.iterations ?? 20000;
  const span = best.length - frozenCount;
  if (span >= 2) {
    for (let it = 0; it < iters; it++) {
      const i = frozenCount + Math.floor(rnd() * span);
      const j = frozenCount + Math.floor(rnd() * span);
      if (i === j) continue;
      const cand = best.map((m) => [...m]);
      const a = Math.floor(rnd() * 4);
      const b = Math.floor(rnd() * 4);
      const tmp = cand[i][a];
      cand[i][a] = cand[j][b];
      cand[j][b] = tmp;
      if (!isValid(cand, { n, gap: shape.gap, coreCount: shape.coreCount, requireCore })) continue;
      const c = scoreSchedule(cand, players, w).total;
      if (c < bestCost) {
        best = cand;
        bestCost = c;
      }
    }
  }
  const { splits } = scoreSchedule(best, players, w);
  return splits.map((s, i) => ({
    order: i + 1,
    mandatory: i < shape.coreCount,
    teamA: [players[s.a[0]].id, players[s.a[1]].id],
    teamB: [players[s.b[0]].id, players[s.b[1]].id],
  }));
}

export interface TailInput {
  /** Nguoi con hoat dong NGAY BAY GIO (da toi, chua ve). */
  players: SchedPlayer[];
  /** Cac tran da danh hoac dang danh -> khong duoc dong vao. */
  frozen: number[][];
  /** So tran con lai trong lich. */
  tailCount: number;
  gap: number;
  minPer: number;
  maxPer: number;
  /** false = nguoi da ve / vang, khong duoc xep vao phan con lai. */
  active?: boolean[];
  weights?: Weights;
  iterations?: number;
  seed?: number;
}

export interface TailResult {
  tail: number[][];
  /** So suat con thieu de ai cung dat minPer — > 0 nghia la khong con du tran. */
  unmetNeed: number;
  /** So tran THUC SU xep duoc, co the it hon tailCount neu nhieu nguoi da ve. */
  usableTail: number;
}

/**
 * Xep lai phan duoi cua lich khi doi hinh thay doi giua buoi (co nguoi moi toi, hoac co nguoi ve).
 * Uu tien dua moi nguoi len du minPer truoc, phan du moi chia toi maxPer.
 */
export function buildTail(input: TailInput): TailResult {
  const { players, frozen, tailCount, gap, minPer, maxPer } = input;
  const n = players.length;
  const offset = frozen.length;

  const already = new Array<number>(n).fill(0);
  const last = new Array<number>(n).fill(-999);
  frozen.forEach((m, i) => {
    for (const p of m) {
      if (p >= 0 && p < n) {
        already[p] += 1;
        last[p] = i;
      }
    }
  });

  const isActive = (p: number) => input.active?.[p] !== false;
  const cap = already.map((a, p) => (isActive(p) ? Math.max(0, maxPer - a) : 0));
  const target = already.map((a, p) => (isActive(p) ? Math.max(0, minPer - a) : 0));
  for (let p = 0; p < n; p++) target[p] = Math.min(target[p], cap[p]);

  const capacity = cap.reduce((x, y) => x + y, 0);
  const usableTail = Math.min(tailCount, Math.floor(capacity / 4));
  const tailSlots = usableTail * 4;

  let unmetNeed = 0;
  let assigned = target.reduce((x, y) => x + y, 0);
  if (assigned > tailSlots) {
    // Khong du tran cho tat ca -> cat bot tu nguoi da danh nhieu nhat.
    unmetNeed = assigned - tailSlots;
    const order = [...target.keys()].sort((a, b) => already[b] - already[a]);
    let over = unmetNeed;
    for (const p of order) {
      while (over > 0 && target[p] > 0) {
        target[p] -= 1;
        over -= 1;
      }
      if (over === 0) break;
    }
    assigned = tailSlots;
  } else {
    // Con du -> chia tiep cho nguoi it tran nhat, toi da maxPer.
    let left = tailSlots - assigned;
    while (left > 0) {
      const order = [...target.keys()]
        .filter((p) => target[p] < cap[p])
        .sort((a, b) => already[a] + target[a] - (already[b] + target[b]));
      if (!order.length) break;
      for (const p of order) {
        if (left === 0) break;
        target[p] += 1;
        left -= 1;
      }
    }
  }

  const w = input.weights ?? DEFAULT_WEIGHTS;
  const seed0 = input.seed ?? 31;
  let tail: number[][] | null = null;
  for (let s = 0; s < 4000 && !tail; s++) {
    const rnd = mulberry32(seed0 + s);
    const lastTry = [...last];
    const left = [...target];
    const out: number[][] = [];
    let ok = true;
    for (let i = 0; i < usableTail; i++) {
      const gi = offset + i;
      const avail: number[] = [];
      for (let p = 0; p < n; p++) if (gi - lastTry[p] >= gap && left[p] > 0) avail.push(p);
      if (avail.length < 4) {
        ok = false;
        break;
      }
      const jitter = new Map(avail.map((p) => [p, rnd()]));
      avail.sort((a, b) => left[b] - left[a] || lastTry[a] - lastTry[b] || jitter.get(a)! - jitter.get(b)!);
      const pick = avail.slice(0, 4);
      for (const p of pick) {
        lastTry[p] = gi;
        left[p] -= 1;
      }
      out.push(pick);
    }
    if (ok && left.every((v) => v === 0)) tail = out;
  }

  // Khong sinh duoc voi quota chuan -> ha yeu cau, mien la du khoang cach.
  if (!tail) {
    const lastTry = [...last];
    const left = [...cap];
    const out: number[][] = [];
    const rnd = mulberry32(seed0);
    for (let i = 0; i < usableTail; i++) {
      const gi = offset + i;
      const avail: number[] = [];
      for (let p = 0; p < n; p++) if (gi - lastTry[p] >= gap && left[p] > 0) avail.push(p);
      if (avail.length < 4) break;
      const jitter = new Map(avail.map((p) => [p, rnd()]));
      avail.sort((a, b) => left[b] - left[a] || lastTry[a] - lastTry[b] || jitter.get(a)! - jitter.get(b)!);
      const pick = avail.slice(0, 4);
      for (const p of pick) {
        lastTry[p] = gi;
        left[p] -= 1;
      }
      out.push(pick);
    }
    tail = out;
    unmetNeed = Math.max(unmetNeed, target.reduce((x, y) => x + y, 0) - out.length * 4);
  }

  // Tinh chinh cap danh trong phan duoi, giu nguyen so tran tung nguoi.
  const full = [...frozen, ...tail];
  const rnd = mulberry32(seed0 + 777);
  let best = full.map((m) => [...m]);
  let bestCost = scoreSchedule(best, players, w).total;
  const span = tail.length;
  if (span >= 2) {
    for (let it = 0; it < (input.iterations ?? 15000); it++) {
      const i = offset + Math.floor(rnd() * span);
      const j = offset + Math.floor(rnd() * span);
      if (i === j) continue;
      const cand = best.map((m) => [...m]);
      const a = Math.floor(rnd() * 4);
      const b = Math.floor(rnd() * 4);
      const tmp = cand[i][a];
      cand[i][a] = cand[j][b];
      cand[j][b] = tmp;
      if (!isValid(cand, { n, gap })) continue;
      const c = scoreSchedule(cand, players, w).total;
      if (c < bestCost) {
        best = cand;
        bestCost = c;
      }
    }
  }

  const finalTail = best.slice(offset);
  // Duong du phong co the xep duoc it tran hon du tinh -> bao con so THAT, khong bao con so ky vong.
  return { tail: finalTail, unmetNeed: Math.max(0, unmetNeed), usableTail: finalTail.length };
}

/** Chia doi 4 nguoi thanh 2 doi can nhat, dung cho phan duoi vua sinh. */
export function splitRosters(players: SchedPlayer[], rosters: number[][], weights?: Weights) {
  const { splits } = scoreSchedule(rosters, players, weights ?? DEFAULT_WEIGHTS);
  return splits.map((s) => ({
    teamA: [players[s.a[0]].id, players[s.a[1]].id] as [string, string],
    teamB: [players[s.b[0]].id, players[s.b[1]].id] as [string, string],
  }));
}
