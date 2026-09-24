import { formatVnd } from './money';
import type { Session } from '../types';

export interface ShareRow {
  name: string;
  female: boolean;
  matches: number;
  fee: number;
  paid: boolean;
}

export interface ShareMatch {
  order: number;
  a: string;
  b: string;
  scoreA?: number;
  scoreB?: number;
}

export interface ShareBank {
  bank: string;
  account: string;
  holder?: string;
}

export interface ShareData {
  session: Session;
  rows: ShareRow[];
  matches: ShareMatch[];
  bank?: ShareBank;
  totals: { cost: number; expected: number; collected: number; profit: number };
}

export interface ShareOptions {
  money: boolean;
  results: boolean;
  /** Lai/lo cua host — mac dinh TAT, vi thuong khong muon ca nhom nhin thay. */
  profit: boolean;
  bank: boolean;
}

export const DEFAULT_SHARE: ShareOptions = { money: true, results: true, profit: false, bank: true };

const ngay = (iso: string) => iso.split('-').reverse().join('/');

/** Ban chu de dan thang vao Zalo khi khong muon gui anh. */
export function shareText(d: ShareData, o: ShareOptions): string {
  const s = d.session;
  const out: string[] = [];
  out.push(`🏸 ${s.venue || 'Buổi cầu lông'} · ${ngay(s.date)}`);
  out.push(`${s.courtCount} sân · ${s.durationMin}′ · ${d.rows.length} người · ${d.matches.length} trận`);

  if (o.money && d.rows.length) {
    out.push('', '💰 TIỀN');
    const w = Math.max(...d.rows.map((r) => r.name.length));
    d.rows.forEach((r) => {
      out.push(`${r.name.padEnd(w)}  ${String(r.matches).padStart(2)} trận  ${formatVnd(r.fee).padStart(9)}${r.paid ? '  ✅' : ''}`);
    });
    out.push(`Tổng thu: ${formatVnd(d.totals.expected)}`);
    if (d.totals.expected > d.totals.collected) {
      out.push(`Còn thiếu: ${formatVnd(d.totals.expected - d.totals.collected)}`);
    }
    if (o.profit) {
      out.push(`Chi: ${formatVnd(d.totals.cost)} · ${d.totals.profit >= 0 ? 'Lãi' : 'Lỗ'} ${formatVnd(Math.abs(d.totals.profit))}`);
    }
  }

  if (o.bank && d.bank) {
    out.push('', `🏦 ${d.bank.bank} · ${d.bank.account}${d.bank.holder ? ` · ${d.bank.holder}` : ''}`);
  }

  if (o.results) {
    const coDiem = d.matches.filter((m) => m.scoreA != null && m.scoreB != null);
    if (coDiem.length) {
      out.push('', '🏆 KẾT QUẢ');
      coDiem.forEach((m) => out.push(`${String(m.order).padStart(2)}. ${m.a} ${m.scoreA}–${m.scoreB} ${m.b}`));
    }
  }

  return out.join('\n');
}
