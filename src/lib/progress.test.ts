import { describe, expect, it } from 'vitest';
import { sessionProgress, sessionStatus, type StepKey } from './progress';
import { DEFAULT_SESSION } from './actions';
import type { Match, Session } from '../types';

const session = (p: Partial<Session> = {}): Session => ({ ...DEFAULT_SESSION, id: 's', createdAt: 0, ...p });
const people = (n: number, status: 'arrived' | 'pending' = 'arrived') =>
  Array.from({ length: n }, (_, i) => ({ playerId: `p${i}`, status, fee: 60000, paid: false }));
const match = (order: number, state: Match['state'], courtIndex = 0): Match => ({
  id: `m${order}`, sessionId: 's', order, mandatory: true, courtIndex,
  teamA: ['p0', 'p1'], teamB: ['p2', 'p3'], state,
});
const step = (s: Session, ms: Match[], k: StepKey) => sessionProgress(s, ms).steps.find((x) => x.key === k)!;

describe('cac buoc trong mot buoi', () => {
  it('buoi trong: mo buoc Cai dat, viec tiep theo la dat ten san', () => {
    const p = sessionProgress(session(), []);
    expect(p.current).toBe('setup');
    expect(p.next).toEqual({ label: 'Đặt tên sân', step: 'setup' });
  });

  it('khoa buoc San khi chua xep lich, mo ngay khi co tran', () => {
    const s = session({ venue: 'Tân Phúc', attendees: people(4) });
    expect(step(s, [], 'court').locked).toBe(true);
    expect(step(s, [], 'court').lockReason).toMatch(/Chưa xếp lịch/);
    expect(step(s, [match(1, 'queued')], 'court').locked).toBe(false);
  });

  it('khoa buoc Tien khi chua ai toi — khong khoa vi ly do thu tu', () => {
    const chuaToi = session({ venue: 'X', attendees: people(6, 'pending') });
    expect(step(chuaToi, [], 'money').locked).toBe(true);
    const daToi = session({ venue: 'X', attendees: people(6) });
    expect(step(daToi, [], 'money').locked).toBe(false);
  });

  it('Cai dat va Nguoi khong bao gio bi khoa', () => {
    for (const s of [session(), session({ venue: 'X', attendees: people(14) })]) {
      expect(step(s, [], 'setup').locked).toBe(false);
      expect(step(s, [], 'roster').locked).toBe(false);
    }
  });

  it('dem thieu bao nhieu nguoi de xep duoc lich', () => {
    const s = session({ venue: 'X', attendees: people(2) });
    expect(sessionProgress(s, []).next).toEqual({ label: 'Điểm danh thêm 2 người', step: 'roster' });
  });

  it('du 4 nguoi nhung chua xep lich -> giuc xep lich', () => {
    const s = session({ venue: 'X', attendees: people(5) });
    expect(sessionProgress(s, []).next).toEqual({ label: 'Xếp lịch cho 5 người', step: 'roster' });
  });

  it('dang co tran chay -> mo thang buoc San va giuc nhap diem', () => {
    const s = session({ venue: 'X', attendees: people(8) });
    const ms = [match(1, 'done'), match(2, 'playing'), match(3, 'queued')];
    const p = sessionProgress(s, ms);
    expect(p.current).toBe('court');
    expect(p.next).toEqual({ label: 'Nhập điểm trận 2', step: 'court' });
  });

  it('khong co tran nao chay -> giuc bat dau tran hang doi dau tien', () => {
    const s = session({ venue: 'X', attendees: people(8) });
    const ms = [match(1, 'done'), match(5, 'queued'), match(3, 'queued')];
    expect(sessionProgress(s, ms).next).toEqual({ label: 'Bắt đầu trận 3', step: 'court' });
  });

  it('danh xong het -> mo buoc Tien va giuc thu no', () => {
    const s = session({ venue: 'X', attendees: people(4) });
    const ms = [match(1, 'done'), match(2, 'done')];
    const p = sessionProgress(s, ms);
    expect(p.current).toBe('money');
    expect(p.next?.step).toBe('money');
    expect(p.next?.label).toMatch(/Thu nốt/);
  });

  it('thu du tien roi thi het viec', () => {
    const s = session({
      venue: 'X',
      attendees: people(4).map((a) => ({ ...a, paid: true })),
      courtPricePerHour: 0, shuttlesOut: 0, shuttlesBack: 0,
    });
    const ms = [match(1, 'done')];
    const p = sessionProgress(s, ms);
    expect(p.next).toBeNull();
    expect(step(s, ms, 'money').done).toBe(true);
  });
});

describe('nhan trang thai tren the buoi', () => {
  it('phan biet duoc bon trang thai', () => {
    expect(sessionStatus([])).toMatchObject({ label: 'Chưa xếp lịch', tone: 'slate' });
    expect(sessionStatus([match(1, 'queued'), match(2, 'queued')])).toMatchObject({ label: 'Còn 2/2 trận' });
    expect(sessionStatus([match(1, 'done'), match(7, 'playing')])).toMatchObject({
      label: 'Đang đánh · trận 7', tone: 'teal',
    });
    expect(sessionStatus([match(1, 'done')])).toMatchObject({ label: 'Đã xong', tone: 'emerald' });
  });
});
