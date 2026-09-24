import Dexie, { type Table } from 'dexie';
import type { HostSettings, Match, Player, RatingEvent, Session } from './types';

export class BadmintonDB extends Dexie {
  players!: Table<Player, string>;
  sessions!: Table<Session, string>;
  matches!: Table<Match, string>;
  ratingEvents!: Table<RatingEvent, number>;
  settings!: Table<HostSettings, string>;

  constructor() {
    super('badminton-host');
    this.version(1).stores({
      players: 'id, name, facebookId, facebookUrl, phone, rating',
      sessions: 'id, date, createdAt',
      matches: 'id, sessionId, order, state, [sessionId+order]',
      ratingEvents: '++id, matchId, playerId, at',
    });
    // v2: them cai dat cua host (tai khoan nhan tien). Dexie tu giu nguyen du lieu cu.
    this.version(2).stores({
      settings: 'key',
    });
  }
}

export const db = new BadmintonDB();

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export interface Backup {
  app: 'badminton-host';
  version: 1;
  exportedAt: number;
  players: Player[];
  sessions: Session[];
  matches: Match[];
  ratingEvents: RatingEvent[];
  /** Co tu ban v2. File cu khong co truong nay — nhap lai van chay binh thuong. */
  settings?: HostSettings[];
}

export async function exportBackup(): Promise<Backup> {
  const [players, sessions, matches, ratingEvents, settings] = await Promise.all([
    db.players.toArray(),
    db.sessions.toArray(),
    db.matches.toArray(),
    db.ratingEvents.toArray(),
    db.settings.toArray(),
  ]);
  return { app: 'badminton-host', version: 1, exportedAt: Date.now(), players, sessions, matches, ratingEvents, settings };
}

export async function getHostSettings(): Promise<HostSettings> {
  return (await db.settings.get('host')) ?? { key: 'host' };
}

export async function saveHostSettings(patch: Partial<HostSettings>): Promise<void> {
  const cur = await getHostSettings();
  await db.settings.put({ ...cur, ...patch, key: 'host' });
}

export async function downloadBackup() {
  const data = await exportBackup();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `caulong-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export interface ImportReport {
  playersAdded: number;
  playersMerged: number;
  sessionsAdded: number;
  matchesAdded: number;
  /** Nguoi trung ten nhung khong trung khoa -> host phai tu quyet. */
  needsReview: { incoming: Player; existing: Player }[];
}

/**
 * Nhap backup. Gop tu dong khi trung facebookId / link / dien thoai;
 * chi trung ten thi bao cao lai chu khong gop.
 */
export async function importBackup(data: Backup): Promise<ImportReport> {
  if (data?.app !== 'badminton-host') throw new Error('File không phải backup của app này.');
  const report: ImportReport = {
    playersAdded: 0,
    playersMerged: 0,
    sessionsAdded: 0,
    matchesAdded: 0,
    needsReview: [],
  };
  const existing = await db.players.toArray();
  const byId = new Map(existing.map((p) => [p.id, p]));
  const byFbId = new Map(existing.filter((p) => p.facebookId).map((p) => [p.facebookId!, p]));
  const byFbUrl = new Map(existing.filter((p) => p.facebookUrl).map((p) => [p.facebookUrl!, p]));
  const byPhone = new Map(
    existing.filter((p) => p.phone).map((p) => [p.phone!.replace(/\D/g, ''), p]),
  );
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const byName = new Map(existing.map((p) => [`${norm(p.name)}|${p.gender}`, p]));

  for (const inc of data.players) {
    const hit =
      byId.get(inc.id) ??
      (inc.facebookId ? byFbId.get(inc.facebookId) : undefined) ??
      (inc.facebookUrl ? byFbUrl.get(inc.facebookUrl) : undefined) ??
      (inc.phone ? byPhone.get(inc.phone.replace(/\D/g, '')) : undefined);
    if (hit) {
      // Giu ban co nhieu tran hon -> lich su day du hon.
      if (inc.matchesPlayed > hit.matchesPlayed) {
        await db.players.update(hit.id, {
          rating: inc.rating,
          ratingDeviation: inc.ratingDeviation,
          matchesPlayed: inc.matchesPlayed,
          wins: inc.wins,
          facebookId: inc.facebookId ?? hit.facebookId,
          facebookUrl: inc.facebookUrl ?? hit.facebookUrl,
          phone: inc.phone ?? hit.phone,
        });
      }
      report.playersMerged++;
      continue;
    }
    const nameHit = byName.get(`${norm(inc.name)}|${inc.gender}`);
    if (nameHit) report.needsReview.push({ incoming: inc, existing: nameHit });
    await db.players.put(inc);
    report.playersAdded++;
  }

  for (const s of data.sessions) {
    if (!(await db.sessions.get(s.id))) {
      await db.sessions.put(s);
      report.sessionsAdded++;
    }
  }
  for (const m of data.matches) {
    if (!(await db.matches.get(m.id))) {
      await db.matches.put(m);
      report.matchesAdded++;
    }
  }
  if (data.ratingEvents?.length) await db.ratingEvents.bulkPut(data.ratingEvents.map(({ id: _id, ...r }) => r as RatingEvent));
  const st = data.settings;
  if (st && st.length) await db.settings.bulkPut(st);
  return report;

}

// Chi o dev: mo db ra window de smoke-test va do du lieu nhanh.
if (import.meta.env.DEV) {
  (globalThis as unknown as Record<string, unknown>).__bh = { db, exportBackup, importBackup };
}
