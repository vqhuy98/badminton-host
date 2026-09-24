import { describe, expect, it } from 'vitest';
import { DEFAULT_SHARE, shareText, type ShareData } from './share';
import { DEFAULT_SESSION } from './actions';

const d: ShareData = {
  session: { ...DEFAULT_SESSION, id: 's', createdAt: 0, venue: 'Tân Phúc', date: '2026-09-22' },
  rows: [
    { name: 'An', female: false, matches: 7, fee: 80000, paid: true },
    { name: 'Phương', female: true, matches: 5, fee: 60000, paid: false },
  ],
  matches: [
    { order: 1, a: 'An + Bình', b: 'Mai + Ngân', scoreA: 21, scoreB: 15 },
    { order: 2, a: 'Khoa + Hải', b: 'Long + Đức' },   // chua co diem
  ],
  bank: { bank: 'MBBank', account: '0987654321', holder: 'NGUYEN VAN A' },
  totals: { cost: 920000, expected: 965000, collected: 80000, profit: 45000 },
};

describe('ban chu de dan vao Zalo', () => {
  it('co ten san, ngay kieu Viet Nam va so nguoi', () => {
    const t = shareText(d, DEFAULT_SHARE);
    expect(t).toContain('Tân Phúc · 22/09/2026');
    expect(t).toContain('2 người');
  });

  it('MAC DINH khong lo lai/lo cua host', () => {
    const t = shareText(d, DEFAULT_SHARE);
    expect(DEFAULT_SHARE.profit).toBe(false);
    expect(t).not.toContain('Lãi');
    expect(t).not.toContain('920.000');
    expect(shareText(d, { ...DEFAULT_SHARE, profit: true })).toContain('Lãi 45.000đ');
  });

  it('danh dau ai da tra va tinh con thieu bao nhieu', () => {
    const t = shareText(d, DEFAULT_SHARE);
    expect(t).toMatch(/An.*80\.000đ.*✅/);
    expect(t).toMatch(/Phương.*60\.000đ$/m);
    expect(t).toContain('Còn thiếu: 885.000đ');
  });

  it('chi liet ke tran DA co ti so', () => {
    const t = shareText(d, DEFAULT_SHARE);
    expect(t).toContain('An + Bình 21–15 Mai + Ngân');
    expect(t).not.toContain('Khoa + Hải');
  });

  it('tat tung phan duoc', () => {
    const chiKetQua = shareText(d, { money: false, results: true, profit: false, bank: false });
    expect(chiKetQua).not.toContain('TIỀN');
    expect(chiKetQua).not.toContain('MBBank');
    expect(chiKetQua).toContain('KẾT QUẢ');

    const chiTien = shareText(d, { money: true, results: false, profit: false, bank: true });
    expect(chiTien).toContain('TIỀN');
    expect(chiTien).toContain('MBBank · 0987654321');
    expect(chiTien).not.toContain('KẾT QUẢ');
  });

  it('cot ten thang hang du ten dai ngan khac nhau', () => {
    const dong = shareText(d, DEFAULT_SHARE).split('\n').filter((l) => /trận\s+[\d.]+đ/.test(l));
    const cot = dong.map((l) => l.indexOf('trận'));
    expect(new Set(cot).size).toBe(1);
  });

  it('khong ai thi khong vo, va khong in muc tien rong', () => {
    const t = shareText({ ...d, rows: [] }, DEFAULT_SHARE);
    expect(t).not.toContain('TIỀN');
    expect(t).toContain('Tân Phúc');
  });
});
