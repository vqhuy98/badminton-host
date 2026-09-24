import { formatVnd } from './money';
import type { ShareData, ShareOptions } from './share';

/**
 * Ve anh PNG tom tat buoi de gui Zalo.
 *
 * Ve bang canvas chu khong chup man hinh: chu doc duoc o moi kich thuoc man hinh,
 * va khong dinh thanh cuon / thanh dieu huong cua app.
 */
const W = 1080;
const PAD = 56;
const C = {
  nen: '#0b1220',
  the: '#131c2e',
  vien: '#263350',
  chu: '#e5edff',
  mo: '#94a3b8',
  teal: '#2dd4bf',
  hong: '#f472b6',
  xanh: '#38bdf8',
};
const F = (size: number, weight = '400') =>
  `${weight} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

const ngay = (iso: string) => iso.split('-').reverse().join('/');

interface Khoi {
  cao: number;
  ve: (g: CanvasRenderingContext2D, y: number) => void;
}

export function drawPoster(d: ShareData, o: ShareOptions): HTMLCanvasElement {
  const s = d.session;
  const khoi: Khoi[] = [];

  // --- dau trang
  khoi.push({
    cao: 170,
    ve: (g, y) => {
      g.fillStyle = C.chu;
      g.font = F(58, '700');
      g.fillText(s.venue || 'Buổi cầu lông', PAD, y + 62);
      g.fillStyle = C.mo;
      g.font = F(32);
      g.fillText(
        `${ngay(s.date)} · ${s.courtCount} sân · ${s.durationMin}′ · ${d.rows.length} người · ${d.matches.length} trận`,
        PAD, y + 118,
      );
      g.strokeStyle = C.vien;
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(PAD, y + 150); g.lineTo(W - PAD, y + 150); g.stroke();
    },
  });

  const tieuDe = (text: string): Khoi => ({
    cao: 76,
    ve: (g, y) => {
      g.fillStyle = C.teal;
      g.font = F(34, '700');
      g.fillText(text, PAD, y + 48);
    },
  });

  if (o.money && d.rows.length) {
    khoi.push(tieuDe('TIỀN'));
    const H = 58;
    d.rows.forEach((r, i) => {
      khoi.push({
        cao: H,
        ve: (g, y) => {
          if (i % 2 === 0) { g.fillStyle = C.the; g.fillRect(PAD - 16, y, W - 2 * PAD + 32, H); }
          g.fillStyle = r.female ? C.hong : C.xanh;
          g.font = F(26, '700');
          g.fillText(r.female ? 'NỮ' : 'NAM', PAD, y + 38);
          g.fillStyle = C.chu;
          g.font = F(34, '600');
          g.fillText(r.name, PAD + 86, y + 39);
          g.fillStyle = C.mo;
          g.font = F(28);
          g.textAlign = 'right';
          g.fillText(`${r.matches} trận`, W - PAD - 250, y + 39);
          g.fillStyle = r.paid ? C.teal : C.chu;
          g.font = F(34, '700');
          g.fillText(formatVnd(r.fee) + (r.paid ? '  ✓' : ''), W - PAD, y + 39);
          g.textAlign = 'left';
        },
      });
    });
    const thieu = d.totals.expected - d.totals.collected;
    khoi.push({
      cao: o.profit ? 108 : 70,
      ve: (g, y) => {
        g.strokeStyle = C.vien; g.lineWidth = 2;
        g.beginPath(); g.moveTo(PAD, y + 6); g.lineTo(W - PAD, y + 6); g.stroke();
        g.fillStyle = C.chu; g.font = F(32, '700');
        g.fillText(`Tổng thu ${formatVnd(d.totals.expected)}`, PAD, y + 50);
        if (thieu > 0) {
          g.fillStyle = '#fbbf24'; g.textAlign = 'right';
          g.fillText(`còn thiếu ${formatVnd(thieu)}`, W - PAD, y + 50);
          g.textAlign = 'left';
        }
        if (o.profit) {
          g.fillStyle = C.mo; g.font = F(28);
          g.fillText(
            `Chi ${formatVnd(d.totals.cost)} · ${d.totals.profit >= 0 ? 'Lãi' : 'Lỗ'} ${formatVnd(Math.abs(d.totals.profit))}`,
            PAD, y + 92,
          );
        }
      },
    });
  }

  if (o.bank && d.bank) {
    khoi.push({
      cao: 116,
      ve: (g, y) => {
        g.fillStyle = C.the;
        g.beginPath(); g.roundRect(PAD - 16, y + 8, W - 2 * PAD + 32, 92, 18); g.fill();
        g.fillStyle = C.mo; g.font = F(24);
        g.fillText('CHUYỂN KHOẢN', PAD, y + 42);
        g.fillStyle = C.chu; g.font = F(34, '700');
        g.fillText(`${d.bank!.bank} · ${d.bank!.account}`, PAD, y + 82);
        if (d.bank!.holder) {
          g.fillStyle = C.mo; g.font = F(26); g.textAlign = 'right';
          g.fillText(d.bank!.holder, W - PAD, y + 82); g.textAlign = 'left';
        }
      },
    });
  }

  const coDiem = d.matches.filter((m) => m.scoreA != null && m.scoreB != null);
  if (o.results && coDiem.length) {
    khoi.push(tieuDe('KẾT QUẢ'));
    const H = 50;
    coDiem.forEach((m, i) => {
      khoi.push({
        cao: H,
        ve: (g, y) => {
          if (i % 2 === 0) { g.fillStyle = C.the; g.fillRect(PAD - 16, y, W - 2 * PAD + 32, H); }
          g.fillStyle = C.mo; g.font = F(24);
          g.fillText(String(m.order), PAD, y + 34);
          // To dam ben THANG, khong to mau ti so — to mau chi mot ben khien
          // nguoi xem tuong mau la y nghia khac.
          const aThang = m.scoreA! > m.scoreB!;
          g.textAlign = 'right';
          g.fillStyle = aThang ? C.teal : C.mo;
          g.font = F(28, aThang ? '700' : '400');
          g.fillText(m.a, W / 2 - 80, y + 34);
          g.textAlign = 'center';
          g.fillStyle = C.chu; g.font = F(28, '700');
          g.fillText(`${m.scoreA}–${m.scoreB}`, W / 2, y + 34);
          g.textAlign = 'left';
          g.fillStyle = aThang ? C.mo : C.teal;
          g.font = F(28, aThang ? '400' : '700');
          g.fillText(m.b, W / 2 + 80, y + 34);
        },
      });
    });
  }

  const cao = khoi.reduce((t, k) => t + k.cao, 0) + PAD * 2;
  const cv = document.createElement('canvas');
  // Ve o do phan giai 1x roi de Zalo tu nen — 1080px rong la du net tren dien thoai.
  cv.width = W;
  cv.height = cao;
  const g = cv.getContext('2d')!;
  g.fillStyle = C.nen;
  g.fillRect(0, 0, W, cao);
  g.textBaseline = 'alphabetic';

  let y = PAD;
  for (const k of khoi) { k.ve(g, y); y += k.cao; }
  return cv;
}

export function posterBlob(cv: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) =>
    cv.toBlob((b) => (b ? res(b) : rej(new Error('Không tạo được ảnh.'))), 'image/png'),
  );
}
