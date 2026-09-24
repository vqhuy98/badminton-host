import type { Match, Session } from '../types';
import { schedulablePlayerIds } from './actions';
import { computeMoney, formatVnd, payingAttendees } from './money';

export type StepKey = 'setup' | 'roster' | 'court' | 'money';

export interface Step {
  key: StepKey;
  /** So thu tu hien cho nguoi dung, bat dau tu 1. */
  index: number;
  label: string;
  done: boolean;
  locked: boolean;
  /** Vi sao khoa — hien khi nguoi dung bam vao buoc bi khoa. */
  lockReason?: string;
}

export interface NextAction {
  label: string;
  step: StepKey;
}

export interface Progress {
  steps: Step[];
  /** Buoc nen mo san khi vao buoi. */
  current: StepKey;
  /** Viec duy nhat nen lam tiep. null = khong con viec gi. */
  next: NextAction | null;
}

const LABEL: Record<StepKey, string> = {
  setup: 'Cài đặt',
  roster: 'Người',
  court: 'Sân',
  money: 'Tiền',
};

/**
 * Tinh trang thai tung buoc cua mot buoi.
 *
 * Nguyen tac khoa: chi khoa khi buoc do thuc su VO NGHIA, khong khoa de ep thu tu.
 *  - San vo nghia khi chua co tran nao.
 *  - Tien vo nghia khi chua ai toi (khong co ai de thu).
 * Cai dat va Nguoi khong bao gio khoa — host co the sua bat cu luc nao.
 */
export function sessionProgress(s: Session, matches: Match[]): Progress {
  const arrived = schedulablePlayerIds(s).length;
  const paying = payingAttendees(s).length;
  const total = matches.length;
  const played = matches.filter((m) => m.state === 'done').length;
  const playing = matches.filter((m) => m.state === 'playing').sort((a, b) => a.order - b.order);
  const nextQueued = matches.filter((m) => m.state === 'queued').sort((a, b) => a.order - b.order)[0];
  const allPlayed = total > 0 && played === total;
  const named = s.venue.trim() !== '';
  const money = computeMoney(s);

  const steps: Step[] = [
    { key: 'setup', index: 1, label: LABEL.setup, done: named, locked: false },
    { key: 'roster', index: 2, label: LABEL.roster, done: arrived >= 4, locked: false },
    {
      key: 'court',
      index: 3,
      label: LABEL.court,
      done: allPlayed,
      locked: total === 0,
      lockReason: 'Chưa xếp lịch — vào bước Người rồi bấm “Xếp lịch”.',
    },
    {
      key: 'money',
      index: 4,
      label: LABEL.money,
      done: paying > 0 && money.outstanding === 0,
      locked: paying === 0,
      lockReason: 'Chưa ai đã tới nên chưa có ai để thu tiền.',
    },
  ];

  const current: StepKey =
    total > 0 && !allPlayed ? 'court' : allPlayed ? 'money' : arrived >= 4 ? 'roster' : named ? 'roster' : 'setup';

  let next: NextAction | null = null;
  if (!named) next = { label: 'Đặt tên sân', step: 'setup' };
  else if (arrived < 4)
    next = {
      label: arrived ? `Điểm danh thêm ${4 - arrived} người` : 'Điểm danh người đã tới',
      step: 'roster',
    };
  else if (total === 0) next = { label: `Xếp lịch cho ${arrived} người`, step: 'roster' };
  else if (playing.length) next = { label: `Nhập điểm trận ${playing[0].order}`, step: 'court' };
  else if (nextQueued) next = { label: `Bắt đầu trận ${nextQueued.order}`, step: 'court' };
  else if (money.outstanding > 0) next = { label: `Thu nốt ${formatVnd(money.outstanding)}`, step: 'money' };

  return { steps, current, next };
}

export interface SessionStatus {
  label: string;
  tone: 'slate' | 'teal' | 'emerald' | 'amber';
}

/** Nhan trang thai hien tren the buoi o trang chu. */
export function sessionStatus(matches: Match[]): SessionStatus {
  const total = matches.length;
  if (!total) return { label: 'Chưa xếp lịch', tone: 'slate' };
  const played = matches.filter((m) => m.state === 'done').length;
  const playing = matches.filter((m) => m.state === 'playing').sort((a, b) => a.order - b.order);
  if (playing.length) return { label: `Đang đánh · trận ${playing[0].order}`, tone: 'teal' };
  if (played === total) return { label: 'Đã xong', tone: 'emerald' };
  return { label: `Còn ${total - played}/${total} trận`, tone: 'amber' };
}
