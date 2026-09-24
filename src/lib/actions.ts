import { db, uid } from '../db';
import type { Attendee, AttendStatus, Match, Player, Session } from '../types';
import { LEVELS, type Gender, type LevelLabel } from '../types';
import { defaultFeeFor } from './money';
import { applyResult } from './rating';
import {
  buildTail,
  generateSchedule,
  planShape,
  rebalanceRemaining,
  splitRosters,
  type SchedPlayer,
} from './scheduler';

export const DEFAULT_SESSION: Omit<Session, 'id' | 'createdAt'> = {
  date: new Date().toISOString().slice(0, 10),
  venue: '',
  courtCount: 2,
  startAt: Date.now(),
  durationMin: 120,
  format: { type: 'points', target: 21 },
  minPerPlayer: 6,
  maxPerPlayer: 7,
  courtPricePerHour: 120000,
  shuttlePrice: 20000,
  shuttlesOut: 12,
  shuttlesBack: 12,
  otherCosts: [],
  defaultFee: 60000,
  femaleDiscount: 20000,
  attendees: [],
  shortChanged: [],
  scheduleVersion: 0,
};

export async function createSession(patch: Partial<Session> = {}): Promise<string> {
  const id = uid();
  await db.sessions.put({ ...DEFAULT_SESSION, ...patch, id, createdAt: Date.now() });
  return id;
}

export interface PlayerPatch {
  name: string;
  gender: Gender;
  levelLabel: LevelLabel;
  facebookUrl?: string;
  facebookId?: string;
  phone?: string;
}

/**
 * Sua ho so nguoi choi. Doi trinh do se dat lai rating ve moc cua trinh do do —
 * man hinh sua canh bao truoc khi nguoi choi da co tran.
 */
export async function updatePlayer(id: string, patch: PlayerPatch) {
  const p = await db.players.get(id);
  if (!p) throw new Error('Không tìm thấy người chơi.');
  const levelChanged = p.levelLabel !== patch.levelLabel;
  await db.players.update(id, {
    name: patch.name.trim(),
    gender: patch.gender,
    levelLabel: patch.levelLabel,
    facebookUrl: patch.facebookUrl,
    facebookId: patch.facebookId,
    phone: patch.phone,
    ...(levelChanged ? { rating: LEVELS[patch.levelLabel], ratingDeviation: 200 } : {}),
  });
  return { levelChanged };
}

/** Danh dau ca danh sach la da toi — tranh phai bam 14 lan luc bong lan. */
export async function markAllArrived(sessionId: string) {
  let n = 0;
  await mutateAttendees(sessionId, (list) =>
    list.map((a) => {
      if (a.status !== 'pending') return a;
      n++;
      return { ...a, status: 'arrived' as AttendStatus, arrivedAt: a.arrivedAt ?? Date.now() };
    }),
  );
  return n;
}

export async function createPlayer(input: {
  name: string;
  gender: Gender;
  levelLabel: LevelLabel;
  facebookUrl?: string;
  facebookId?: string;
  phone?: string;
}): Promise<Player> {
  const p: Player = {
    id: uid(),
    name: input.name.trim(),
    gender: input.gender,
    levelLabel: input.levelLabel,
    rating: LEVELS[input.levelLabel],
    // Nguoi moi chua ro trinh -> do bat dinh cao, rating duoc phep nhay manh.
    ratingDeviation: 200,
    matchesPlayed: 0,
    wins: 0,
    facebookUrl: input.facebookUrl,
    facebookId: input.facebookId,
    phone: input.phone,
    owedBonus: false,
    createdAt: Date.now(),
  };
  await db.players.put(p);
  return p;
}

/**
 * Moi thay doi danh sach nguoi deu doc-sua-ghi trong 1 transaction.
 * Ghi de ca mang `attendees` tu mot ban chup cu la cach lam mat nguoi vua them.
 */
async function mutateAttendees(sessionId: string, fn: (list: Attendee[]) => Attendee[]) {
  return db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(sessionId);
    if (!s) throw new Error('Không tìm thấy buổi.');
    const next = fn(s.attendees);
    await db.sessions.update(sessionId, { attendees: next });
    return next;
  });
}

export type AddAttendeeResult = 'added' | 'already';

export async function addAttendee(
  sessionId: string,
  playerId: string,
  opts: { status?: AttendStatus; fee?: number } = {},
): Promise<AddAttendeeResult> {
  let outcome: AddAttendeeResult = 'added';
  await db.transaction('rw', db.sessions, db.players, async () => {
    const s = await db.sessions.get(sessionId);
    if (!s) throw new Error('Không tìm thấy buổi.');
    if (s.attendees.some((a) => a.playerId === playerId)) {
      outcome = 'already';
      return;
    }
    const p = await db.players.get(playerId);
    await db.sessions.update(sessionId, {
      attendees: [
        ...s.attendees,
        // Mac dinh 'chua toi': nguoi vua ghi ten chua co mat o san.
        // Muc thu mac dinh theo gioi tinh — nu dong it hon nam.
        { playerId, status: opts.status ?? 'pending', fee: opts.fee ?? defaultFeeFor(s, p?.gender), paid: false },
      ],
    });
  });
  return outcome;
}

export async function removeAttendee(sessionId: string, playerId: string) {
  await mutateAttendees(sessionId, (list) => list.filter((a) => a.playerId !== playerId));
}

export async function setAttendees(sessionId: string, attendees: Attendee[]) {
  await db.sessions.update(sessionId, { attendees });
}

export async function setAttendStatus(sessionId: string, playerId: string, status: AttendStatus) {
  await mutateAttendees(sessionId, (list) =>
    list.map((a) =>
      a.playerId !== playerId
        ? a
        : {
            ...a,
            status,
            arrivedAt: status === 'arrived' && !a.arrivedAt ? Date.now() : a.arrivedAt,
            leftAt: status === 'left' ? Date.now() : a.leftAt,
          },
    ),
  );
}

/** Buoi da bat dau khi co bat ky tran nao roi trang thai `queued`. */
export async function hasStarted(sessionId: string): Promise<boolean> {
  const n = await db.matches.where('sessionId').equals(sessionId).filter((m) => m.state !== 'queued').count();
  return n > 0;
}

/** Vi tri bat dau phan lich chua danh: sau tran khong-queued cuoi cung. */
function frozenBoundary(sorted: Match[]): number {
  let last = -1;
  sorted.forEach((m, i) => {
    if (m.state !== 'queued') last = i;
  });
  return last + 1;
}

/**
 * Chi nguoi DA TOI moi duoc xep lich. Nguoi 'chua toi' khong the danh tran 1,
 * va nguoi bam 'nghi' la dang xin khong nhan them tran.
 * Khi ho bam 'Da toi', syncScheduleWithRoster chen ho vao phan lich con lai.
 */
export function schedulablePlayerIds(session: Session): string[] {
  return session.attendees.filter((a) => a.status === 'arrived').map((a) => a.playerId);
}

/** Nguoi co ten trong buoi nhung chua the xep lich, kem ly do. */
export function notSchedulable(session: Session): { playerId: string; status: AttendStatus }[] {
  return session.attendees
    .filter((a) => a.status === 'pending' || a.status === 'resting')
    .map((a) => ({ playerId: a.playerId, status: a.status }));
}

async function toSchedPlayers(ids: string[]): Promise<SchedPlayer[]> {
  const rows = await db.players.bulkGet(ids);
  return rows
    .filter((p): p is Player => !!p)
    .map((p) => ({ id: p.id, rating: p.rating, gender: p.gender, owedBonus: p.owedBonus }));
}

export interface GenerateOutcome {
  coreCount: number;
  totalCount: number;
  gap: number;
  backToBackUnavoidable: boolean;
  shortChanged: string[];
  avgImbalance: number;
}

/** Sinh (hoac sinh lai) toan bo lich cho buoi. Xoa het tran cu chua danh. */
export async function generateForSession(sessionId: string): Promise<GenerateOutcome> {
  const s = await db.sessions.get(sessionId);
  if (!s) throw new Error('Không tìm thấy buổi.');
  const ids = schedulablePlayerIds(s);
  const players = await toSchedPlayers(ids);
  const res = generateSchedule(players, {
    minPer: s.minPerPlayer,
    maxPer: s.maxPerPlayer,
    courtCount: s.courtCount,
  });

  await db.matches.where('sessionId').equals(sessionId).delete();
  const rows: Match[] = res.matches.map((m) => ({
    id: uid(),
    sessionId,
    order: m.order,
    mandatory: m.mandatory,
    teamA: m.teamA,
    teamB: m.teamB,
    state: 'queued',
  }));
  await db.matches.bulkPut(rows);
  await db.sessions.update(sessionId, {
    shortChanged: res.shortChanged,
    scheduleVersion: s.scheduleVersion + 1,
  });

  return {
    coreCount: res.shape.coreCount,
    totalCount: res.shape.totalCount,
    gap: res.shape.gap,
    backToBackUnavoidable: res.shape.backToBackUnavoidable,
    shortChanged: res.shortChanged,
    avgImbalance: res.stats.avgImbalance,
  };
}

/** Xem truoc so tran/nguoi ma khong ghi gi -> dung cho man hinh tao buoi. */
export function previewShape(playerCount: number, opts: { minPer: number; maxPer: number; courtCount: number }) {
  const fake: SchedPlayer[] = Array.from({ length: playerCount }, (_, i) => ({
    id: `x${i}`,
    rating: 1300,
    gender: 'M' as Gender,
  }));
  return planShape(fake, opts);
}

/**
 * Dieu phoi san: tran nao xong thi day tran tiep theo len dung san do.
 * Bo qua tran co nguoi dang ban de khong bao gio xep 1 nguoi vao 2 san cung luc.
 */
export async function syncCourts(sessionId: string) {
  const s = await db.sessions.get(sessionId);
  if (!s) return;
  const all = (await db.matches.where('sessionId').equals(sessionId).toArray()).sort(
    (a, b) => a.order - b.order,
  );
  const playing = all.filter((m) => m.state === 'playing');
  const busy = new Set(playing.flatMap((m) => [...m.teamA, ...m.teamB]));
  const occupied = new Set(playing.map((m) => m.courtIndex));

  for (let court = 0; court < s.courtCount; court++) {
    if (occupied.has(court)) continue;
    const next = all.find(
      (m) => m.state === 'queued' && ![...m.teamA, ...m.teamB].some((p) => busy.has(p)),
    );
    if (!next) break;
    await db.matches.update(next.id, { state: 'playing', courtIndex: court, startedAt: Date.now() });
    for (const p of [...next.teamA, ...next.teamB]) busy.add(p);
  }
}

/** Ket thuc tran. Diem la tuy chon — bo trong van ket thuc duoc, chi la khong cap nhat rating. */
export async function finishMatch(matchId: string, scoreA?: number, scoreB?: number) {
  const m = await db.matches.get(matchId);
  if (!m) return;
  const ids = [...m.teamA, ...m.teamB];
  const rows = (await db.players.bulkGet(ids)).filter((p): p is Player => !!p);
  const map = new Map(rows.map((p) => [p.id, p]));

  const updated: Match = { ...m, scoreA, scoreB, state: 'done', endedAt: Date.now() };
  await db.matches.update(matchId, {
    scoreA,
    scoreB,
    state: 'done',
    endedAt: updated.endedAt,
    startedAt: m.startedAt ?? Date.now(),
  });

  const deltas = applyResult(updated, map);
  const winners = new Set(
    scoreA != null && scoreB != null ? (scoreA > scoreB ? m.teamA : m.teamB) : [],
  );
  for (const p of rows) {
    const d = deltas.find((x) => x.playerId === p.id);
    await db.players.update(p.id, {
      matchesPlayed: p.matchesPlayed + 1,
      wins: p.wins + (winners.has(p.id) ? 1 : 0),
      ...(d ? { rating: d.after, ratingDeviation: Math.max(60, p.ratingDeviation * 0.92) } : {}),
    });
  }
  if (deltas.length) {
    await db.ratingEvents.bulkAdd(
      deltas.map((d) => ({ matchId, playerId: d.playerId, before: d.before, after: d.after, delta: d.delta, at: Date.now() })),
    );
    // Co diem -> rating da doi -> can lai cac tran chua danh NGAY, truoc khi day tran ke tiep len san.
    await rebalanceUnplayed(m.sessionId);
  }
  await syncCourts(m.sessionId);
}

/**
 * Can lai cac tran CHUA bat dau sau khi rating thay doi giua buoi.
 * Giu nguyen so tran cua tung nguoi -> khong ai bi mat suat.
 */
export async function rebalanceUnplayed(sessionId: string) {
  const s = await db.sessions.get(sessionId);
  if (!s) throw new Error('Không tìm thấy buổi.');
  const all = (await db.matches.where('sessionId').equals(sessionId).toArray()).sort(
    (a, b) => a.order - b.order,
  );
  const frozen = frozenBoundary(all);
  if (all.length - frozen < 2) return 0;

  const ids = [...new Set(all.flatMap((m) => [...m.teamA, ...m.teamB]))];
  const players = await toSchedPlayers(ids);
  const index = new Map(players.map((p, i) => [p.id, i]));
  const rosters = all.map((m) => [...m.teamA, ...m.teamB].map((id) => index.get(id)!));
  const shape = planShape(players, {
    minPer: s.minPerPlayer,
    maxPer: s.maxPerPlayer,
    courtCount: s.courtCount,
  });

  const next = rebalanceRemaining(players, rosters, frozen, shape);
  let changed = 0;
  for (let i = frozen; i < all.length; i++) {
    const before = [...all[i].teamA, ...all[i].teamB].join(',');
    const after = [...next[i].teamA, ...next[i].teamB].join(',');
    if (before !== after) changed++;
    await db.matches.update(all[i].id, { teamA: next[i].teamA, teamB: next[i].teamB });
  }
  return changed;
}

/** Thay nguoi vang bang nguoi khac trong moi tran chua danh. */
export async function substitute(sessionId: string, outId: string, inId: string) {
  const all = await db.matches.where('sessionId').equals(sessionId).toArray();
  const swap = (t: [string, string]): [string, string] =>
    t.map((x) => (x === outId ? inId : x)) as [string, string];
  let n = 0;
  for (const m of all) {
    if (m.state !== 'queued') continue;
    if (![...m.teamA, ...m.teamB].includes(outId)) continue;
    if ([...m.teamA, ...m.teamB].includes(inId)) continue;
    await db.matches.update(m.id, { teamA: swap(m.teamA), teamB: swap(m.teamB) });
    n++;
  }
  return n;
}

/** Rut cac tran con lai xuong the thuc ngan hon de kip vach. */
export async function shortenFormat(sessionId: string, target: 15 | 21) {
  await db.sessions.update(sessionId, { format: { type: 'points', target } });
}


export interface ReplanResult {
  /** So tran da danh / dang danh duoc giu nguyen, ke ca ti so. */
  kept: number;
  /** So tran chua danh sau khi xep lai. */
  tailCount: number;
  added: number;
  removed: number;
  coreCount: number;
  unmetNeed: number;
}

/**
 * Xep lai lich TU DIEM HIEN TAI. Tran da danh va dang danh duoc giu nguyen cung ti so;
 * chi phan chua danh duoc tinh lai, va duoc THEM tran neu doi hinh dong len.
 *
 * Day la phep duy nhat dung khi buoi da bat dau — `generateForSession` xoa sach ket qua.
 */
export async function replanFromNow(sessionId: string): Promise<ReplanResult> {
  const s = await db.sessions.get(sessionId);
  if (!s) throw new Error('Không tìm thấy buổi.');
  const all = (await db.matches.where('sessionId').equals(sessionId).toArray()).sort((a, b) => a.order - b.order);
  const frozen = frozenBoundary(all);

  const activeIds = schedulablePlayerIds(s);
  if (activeIds.length < 4) throw new Error('Cần ít nhất 4 người đã tới.');

  const playedIds = all.slice(0, frozen).flatMap((m) => [...m.teamA, ...m.teamB]);
  const ids = [...new Set([...activeIds, ...playedIds])];
  const players = await toSchedPlayers(ids);
  const index = new Map(players.map((p, i) => [p.id, i]));
  const activeSet = new Set(activeIds);
  const active = players.map((p) => activeSet.has(p.id));

  const frozenRosters = all
    .slice(0, frozen)
    .map((m) => [...m.teamA, ...m.teamB].map((id) => index.get(id)!));

  const already = new Array(players.length).fill(0);
  for (const m of frozenRosters) for (const p of m) already[p] += 1;

  // So tran can THEM de ai cung du minPer, va tran toi da truoc khi ai do vuot maxPer.
  let needSlots = 0;
  let capSlots = 0;
  players.forEach((_, i) => {
    if (!active[i]) return;
    needSlots += Math.max(0, s.minPerPlayer - already[i]);
    capSlots += Math.max(0, s.maxPerPlayer - already[i]);
  });
  const tailTarget = Math.max(Math.ceil(needSlots / 4), Math.floor(capSlots / 4));

  const shape = planShape(
    players.filter((_, i) => active[i]),
    { minPer: s.minPerPlayer, maxPer: s.maxPerPlayer, courtCount: s.courtCount },
  );

  const res = buildTail({
    players,
    frozen: frozenRosters,
    tailCount: tailTarget,
    gap: shape.gap,
    minPer: s.minPerPlayer,
    maxPer: s.maxPerPlayer,
    active,
  });
  const splits = splitRosters(players, res.tail);

  // Ghi de cac tran chua danh; them tran moi neu can, bo tran thua.
  const queued = all.slice(frozen);
  const tailRows: Match[] = [];
  for (let i = 0; i < splits.length; i++) {
    const order = frozen + i + 1;
    const teamA = splits[i].teamA;
    const teamB = splits[i].teamB;
    if (i < queued.length) {
      await db.matches.update(queued[i].id, { order, teamA, teamB });
      tailRows.push({ ...queued[i], order, teamA, teamB });
    } else {
      const row: Match = { id: uid(), sessionId, order, mandatory: false, teamA, teamB, state: 'queued' };
      await db.matches.put(row);
      tailRows.push(row);
    }
  }
  const removedRows = queued.slice(splits.length);
  if (removedRows.length) await db.matches.bulkDelete(removedRows.map((m) => m.id));

  const kept = [...all.slice(0, frozen), ...tailRows];
  const coreCount = mandatoryBoundary(
    kept.map((m) => [...m.teamA, ...m.teamB]),
    activeSet,
    s.minPerPlayer,
  );
  for (let i = 0; i < kept.length; i++) {
    const mandatory = i < coreCount;
    if (kept[i].mandatory !== mandatory) await db.matches.update(kept[i].id, { mandatory });
  }

  const total = new Map<string, number>();
  for (const m of kept) for (const id of [...m.teamA, ...m.teamB]) total.set(id, (total.get(id) ?? 0) + 1);
  await db.sessions.update(sessionId, {
    shortChanged: activeIds.filter((id) => (total.get(id) ?? 0) <= s.minPerPlayer),
  });

  return {
    kept: frozen,
    tailCount: splits.length,
    added: Math.max(0, splits.length - queued.length),
    removed: removedRows.length,
    coreCount,
    unmetNeed: res.unmetNeed,
  };
}

export interface SyncResult extends ReplanResult {
  changed: boolean;
  addedPlayers: string[];
  removedPlayers: string[];
}

/**
 * Doi hinh doi giua buoi (co nguoi toi / co nguoi ve) -> xep lai phan chua danh.
 * Khong dong vao tran da danh.
 */
export async function syncScheduleWithRoster(sessionId: string): Promise<SyncResult> {
  const idle: SyncResult = {
    changed: false, addedPlayers: [], removedPlayers: [],
    kept: 0, tailCount: 0, added: 0, removed: 0, coreCount: 0, unmetNeed: 0,
  };
  const s = await db.sessions.get(sessionId);
  if (!s) return idle;
  const all = (await db.matches.where('sessionId').equals(sessionId).toArray()).sort((a, b) => a.order - b.order);
  if (!all.length) return idle;

  const frozen = frozenBoundary(all);
  const activeIds = new Set(schedulablePlayerIds(s));
  const inTail = new Set(all.slice(frozen).flatMap((m) => [...m.teamA, ...m.teamB]));
  const addedPlayers = [...activeIds].filter((id) => !inTail.has(id));
  const removedPlayers = [...inTail].filter((id) => !activeIds.has(id));
  if (!addedPlayers.length && !removedPlayers.length) {
    return { ...idle, coreCount: all.filter((m) => m.mandatory).length };
  }
  if (activeIds.size < 4) return { ...idle, coreCount: all.filter((m) => m.mandatory).length };

  const r = await replanFromNow(sessionId);
  return { ...r, changed: true, addedPlayers, removedPlayers };
}

/**
 * Vach nam o tran dau tien ma MOI nguoi con hoat dong da dat minPer
 * (hoac da dat het so tran ho co the danh trong lich nay).
 */
export function mandatoryBoundary(
  rosters: string[][],
  activeIds: Set<string>,
  minPer: number,
): number {
  const total = new Map<string, number>();
  for (const m of rosters) for (const id of m) total.set(id, (total.get(id) ?? 0) + 1);

  const need = new Map<string, number>();
  for (const [id, n] of total) if (activeIds.has(id)) need.set(id, Math.min(minPer, n));
  if (!need.size) return rosters.length;

  const seen = new Map<string, number>();
  for (let i = 0; i < rosters.length; i++) {
    for (const id of rosters[i]) seen.set(id, (seen.get(id) ?? 0) + 1);
    let done = true;
    for (const [id, target] of need) {
      if ((seen.get(id) ?? 0) < target) {
        done = false;
        break;
      }
    }
    if (done) return i + 1;
  }
  return rosters.length;
}
