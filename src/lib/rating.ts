import type { Match, Player } from '../types';
import { teamStrength } from './scheduler';

/** K giam dan theo so tran: nguoi moi hoi tu nhanh, nguoi cu on dinh. */
export function kFactor(matchesPlayed: number): number {
  if (matchesPlayed < 10) return 40;
  if (matchesPlayed < 30) return 24;
  return 16;
}

export interface RatingDelta {
  playerId: string;
  before: number;
  after: number;
  delta: number;
}

/**
 * Cap nhat Elo sau 1 tran doi. Bo qua neu tran chua co diem.
 * Nhan theo cach biet diem -> thang 21-5 an diem nhieu hon thang 21-19.
 */
export function applyResult(match: Match, players: Map<string, Player>): RatingDelta[] {
  if (match.scoreA == null || match.scoreB == null || match.scoreA === match.scoreB) return [];
  const get = (id: string) => players.get(id);
  const teamA = match.teamA.map(get);
  const teamB = match.teamB.map(get);
  if (teamA.some((p) => !p) || teamB.some((p) => !p)) return [];

  const ra = teamStrength(teamA[0]!.rating, teamA[1]!.rating);
  const rb = teamStrength(teamB[0]!.rating, teamB[1]!.rating);
  const expectA = 1 / (1 + 10 ** ((rb - ra) / 400));
  const aWon = match.scoreA > match.scoreB;
  const target = Math.max(match.scoreA, match.scoreB) || 21;
  const margin = 1 + Math.abs(match.scoreA - match.scoreB) / target;

  const out: RatingDelta[] = [];
  for (const [team, won, expect] of [
    [teamA, aWon, expectA],
    [teamB, !aWon, 1 - expectA],
  ] as const) {
    for (const p of team) {
      const k = kFactor(p!.matchesPlayed);
      const delta = k * margin * ((won ? 1 : 0) - expect);
      out.push({
        playerId: p!.id,
        before: p!.rating,
        after: Math.round(p!.rating + delta),
        delta: Math.round(delta),
      });
    }
  }
  return out;
}
