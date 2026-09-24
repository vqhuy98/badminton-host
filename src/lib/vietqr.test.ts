import { describe, expect, it } from 'vitest';
import { crc16, sachNoiDung, tlv, vietQrPayload } from './vietqr';
import { BANKS, bankByBin } from './banks';

describe('CRC cua ma QR', () => {
  it('khop vector chuan cua CRC-16/CCITT-FALSE', () => {
    // Vector kiem thu duoc cong bo rong rai cho CRC-16/CCITT-FALSE.
    expect(crc16('123456789')).toBe(0x29b1);
  });
  it('doi mot ky tu la doi CRC', () => {
    expect(crc16('123456789')).not.toBe(crc16('123456780'));
  });
});

describe('dong goi truong TLV', () => {
  it('do dai luon 2 chu so, tinh theo ky tu', () => {
    expect(tlv('00', '01')).toBe('000201');
    expect(tlv('54', '90000')).toBe('540590000');
  });
  it('tu choi noi dung dai qua 99 ky tu', () => {
    expect(() => tlv('62', 'x'.repeat(100))).toThrow(/99/);
  });
});

describe('noi dung chuyen khoan', () => {
  it('bo dau tieng Viet va ky tu la', () => {
    expect(sachNoiDung('Cầu lông 22/09 — Ngân')).toBe('Cau long 22 09 Ngan');
    expect(sachNoiDung('Đức')).toBe('Duc');
  });
});

describe('ma VietQR', () => {
  const co = { bankBin: '970436', accountNumber: '1234567890' };

  it('dung khung EMVCo va tu kiem tra duoc CRC', () => {
    const s = vietQrPayload({ ...co, amount: 90000, message: 'Cau long' });
    expect(s.startsWith('000201')).toBe(true);
    expect(s.slice(-8, -4)).toBe('6304');
    // Doc lai 4 ky tu CRC cuoi va tinh lai tren phan con lai -> phai khop.
    const than = s.slice(0, -4);
    expect(crc16(than).toString(16).toUpperCase().padStart(4, '0')).toBe(s.slice(-4));
  });

  it('nhung dung ma ngan hang va so tai khoan vao truong 38', () => {
    const s = vietQrPayload(co);
    expect(s).toContain('0006970436');      // BIN Vietcombank
    expect(s).toContain('01101234567890');  // so tai khoan, dai 10
    expect(s).toContain('A000000727');      // GUID cua NAPAS
    expect(s).toContain('0208QRIBFTTA');    // chuyen den tai khoan
  });

  it('co tien thi la ma mot lan, khong tien thi dung lai duoc', () => {
    expect(vietQrPayload({ ...co, amount: 90000 })).toContain('010212');
    expect(vietQrPayload({ ...co, amount: 90000 })).toContain('540590000');
    expect(vietQrPayload(co)).toContain('010211');
    expect(vietQrPayload(co)).not.toContain('5405');
  });

  it('tien le duoc lam tron ve so nguyen dong', () => {
    expect(vietQrPayload({ ...co, amount: 64285.7 })).toContain('540564286');
  });

  it('chan ma ngan hang va so tai khoan sai', () => {
    expect(() => vietQrPayload({ ...co, bankBin: '97043' })).toThrow(/6 chữ số/);
    expect(() => vietQrPayload({ ...co, accountNumber: '12' })).toThrow(/không hợp lệ/);
  });
});

describe('danh sach ngan hang dong goi san', () => {
  it('moi ma BIN deu la 6 chu so va khong trung nhau', () => {
    const bins = BANKS.map((b) => b.bin);
    expect(bins.every((b) => /^\d{6}$/.test(b))).toBe(true);
    expect(new Set(bins).size).toBe(bins.length);
  });
  it('tra cuu duoc vai ngan hang lon', () => {
    expect(bankByBin('970436')?.ten).toBe('Vietcombank');
    expect(bankByBin('970415')?.ten).toBe('VietinBank');
    expect(bankByBin('970418')?.ten).toBe('BIDV');
  });
});

/** Giai nguoc chuoi TLV -> map. Dung de kiem tra do dai khai bao co dung khong. */
function giaiTlv(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < s.length) {
    const id = s.slice(i, i + 2);
    const len = Number(s.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(s.slice(i + 2, i + 4))) throw new Error(`Độ dài hỏng ở vị trí ${i}`);
    const val = s.slice(i + 4, i + 4 + len);
    if (val.length !== len) throw new Error(`Trường ${id} khai ${len} nhưng chỉ có ${val.length}`);
    out[id] = val;
    i += 4 + len;
  }
  return out;
}

describe('giai nguoc ma da sinh', () => {
  it('moi truong khai dung do dai, khong thua khong thieu ky tu', () => {
    const s = vietQrPayload({
      bankBin: '970422', accountNumber: '0987654321', amount: 64286, message: 'Cau long 22 09 Duc',
    });
    const f = giaiTlv(s);   // nem loi neu bat ky truong nao lech do dai
    expect(f['00']).toBe('01');
    expect(f['53']).toBe('704');
    expect(f['54']).toBe('64286');
    expect(f['58']).toBe('VN');
    expect(f['63']).toHaveLength(4);

    const m = giaiTlv(f['38']);
    expect(m['00']).toBe('A000000727');
    expect(m['02']).toBe('QRIBFTTA');
    const b = giaiTlv(m['01']);
    expect(b['00']).toBe('970422');
    expect(b['01']).toBe('0987654321');

    expect(giaiTlv(f['62'])['08']).toBe('Cau long 22 09 Duc');
  });

  it('ten dai va co dau van giai nguoc duoc', () => {
    const s = vietQrPayload({
      bankBin: '970436', accountNumber: '1234567890', amount: 90000,
      message: 'Cầu lông 22/09 — Nguyễn Thị Phương Ngân đóng tiền sân và cầu',
    });
    const f = giaiTlv(s);
    expect(giaiTlv(f['62'])['08']).not.toMatch(/[^\x20-\x7E]/);   // chi con ASCII
    expect(f['63']).toBe(s.slice(-4));
  });
});
