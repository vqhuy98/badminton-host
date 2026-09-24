/**
 * Sinh ma VietQR (chuan EMVCo / NAPAS) ngay tren may — khong goi mang, nen van
 * dung duoc o san khong co song.
 *
 * Cau truc: moi truong la <id 2 so><do dai 2 so><noi dung>, long nhau duoc.
 * Truong 63 (CRC) luon nam cuoi va tinh tren TOAN BO chuoi ke ca "6304".
 */

/** <id><len><value>. Do dai tinh theo KY TU, luon 2 chu so. */
export function tlv(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  if (value.length > 99) throw new Error(`Trường ${id} dài quá 99 ký tự.`);
  return id + len + value;
}

/**
 * CRC-16/CCITT-FALSE: poly 0x1021, khoi tao 0xFFFF, khong dao bit, khong xor cuoi.
 * Kiem chung bang vector chuan: crc16('123456789') === 0x29B1.
 */
export function crc16(s: string): number {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

/** Bo dau tieng Viet va ky tu la — noi dung chuyen khoan chi nhan ASCII. */
export function sachNoiDung(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^0-9A-Za-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface VietQrInput {
  /** Ma BIN 6 so cua ngan hang nhan. */
  bankBin: string;
  accountNumber: string;
  /** So tien VND. Bo trong / 0 = ma khong gan tien, nguoi tra tu nhap. */
  amount?: number;
  /** Noi dung chuyen khoan. */
  message?: string;
}

export function vietQrPayload({ bankBin, accountNumber, amount, message }: VietQrInput): string {
  if (!/^\d{6}$/.test(bankBin)) throw new Error('Mã ngân hàng phải là 6 chữ số.');
  const stk = accountNumber.replace(/\s/g, '');
  if (!/^[0-9A-Za-z]{4,19}$/.test(stk)) throw new Error('Số tài khoản không hợp lệ.');

  const beneficiary = tlv('00', bankBin) + tlv('01', stk);
  const merchant = tlv('00', 'A000000727') + tlv('01', beneficiary) + tlv('02', 'QRIBFTTA');

  let s =
    tlv('00', '01') +
    // 11 = ma dung lai nhieu lan, 12 = ma mot lan (co gan so tien cu the).
    tlv('01', amount && amount > 0 ? '12' : '11') +
    tlv('38', merchant) +
    tlv('53', '704') +
    (amount && amount > 0 ? tlv('54', String(Math.round(amount))) : '') +
    tlv('58', 'VN');

  const noiDung = sachNoiDung(message ?? '').slice(0, 99 - 4);
  if (noiDung) s += tlv('62', tlv('08', noiDung));

  s += '6304';
  return s + crc16(s).toString(16).toUpperCase().padStart(4, '0');
}
