import type { Match, Session } from '../types';

export interface Pacing {
  elapsedMin: number;
  remainingMin: number;
  done: number;
  /** Phut thuc te trung binh cho 1 tran, do tu cac tran da xong. */
  actualMinPerMatch: number | null;
  /** Phut/tran can dat tu GIO tro di de kip vach. Giam dan neu dang cham. */
  requiredMinPerMatch: number;
  /** Du kien tong so tran kip danh het buoi. */
  projectedTotal: number;
  coreCount: number;
  totalCount: number;
  /** So nguoi se khong du minPer neu giu toc do nay. */
  shortfallMatches: number;
  level: 'ok' | 'warn' | 'danger' | 'info';
  /** False khi chua tran nao xong -> chua co bang chung de canh bao. */
  hasData: boolean;
  message: string;
}

const MIN = 60_000;

export function computePacing(
  session: Session,
  matches: Match[],
  coreCount: number,
  now = Date.now(),
): Pacing {
  const elapsedMin = Math.max(0, (now - session.startAt) / MIN);
  const remainingMin = Math.max(0, session.durationMin - elapsedMin);
  const finished = matches.filter((m) => m.state === 'done' && m.startedAt != null && m.endedAt != null);
  const done = matches.filter((m) => m.state === 'done').length;
  const totalCount = matches.length;

  const actual = finished.length
    ? finished.reduce((t, m) => t + (m.endedAt! - m.startedAt!), 0) / finished.length / MIN
    : null;

  const remainingMandatory = Math.max(0, coreCount - done);
  const requiredMinPerMatch =
    (remainingMin * session.courtCount) / Math.max(1, remainingMandatory);
  const rate = actual ?? requiredMinPerMatch;
  // Epsilon chong sai so dau cham dong: dung toc do yeu cau o phut 0 phai ra dung coreCount.
  const projectedTotal = Math.min(
    totalCount,
    done + Math.floor((remainingMin * session.courtCount) / Math.max(1, rate) + 1e-6),
  );
  const shortfallMatches = Math.max(0, coreCount - projectedTotal);

  let level: Pacing['level'] = 'ok';
  let message: string;
  if (!finished.length) {
    // Chua co tran nao xong -> chua do duoc toc do that, khong canh bao suong.
    level = 'info';
    message = `Cần ${requiredMinPerMatch.toFixed(1)} phút/trận để qua vạch ${coreCount} trận.`;
  } else if (shortfallMatches === 0) {
    message =
      projectedTotal >= totalCount
        ? `Dư giờ — kịp cả ${totalCount} trận, ai cũng có thể lên 7 trận.`
        : `Đúng tiến độ — dự kiến xong ${projectedTotal}/${totalCount} trận, vượt vạch ${coreCount}.`;
  } else if (shortfallMatches <= 2) {
    level = 'warn';
    message = `Hơi chậm — dự kiến chỉ ${projectedTotal}/${coreCount} trận bắt buộc, thiếu ${shortfallMatches} trận.`;
  } else {
    level = 'danger';
    message = `Chậm nhiều — thiếu ${shortfallMatches} trận so với vạch ${coreCount}. Nên rút trận còn lại xuống 15 điểm.`;
  }

  return {
    elapsedMin,
    remainingMin,
    done,
    actualMinPerMatch: actual,
    requiredMinPerMatch,
    projectedTotal,
    coreCount,
    totalCount,
    shortfallMatches,
    level,
    message,
    hasData: finished.length > 0,
  };
}

/** Bang moc tien do de host liec nhanh. */
export function checkpoints(session: Session, coreCount: number) {
  const step = session.durationMin / 4;
  return [1, 2, 3, 4].map((i) => ({
    atMin: Math.round(step * i),
    target: Math.round((coreCount * i) / 4),
  }));
}
