import { useLiveQuery } from 'dexie-react-hooks';
import { Banner, Button, Card, Field, NumberInput, Select, TextInput } from '../components/ui';
import { db } from '../db';
import { notSchedulable, previewShape, schedulablePlayerIds } from '../lib/actions';
import type { Session } from '../types';

export default function SetupTab({ session }: { session: Session }) {
  const set = (patch: Partial<Session>) => db.sessions.update(session.id, patch);
  const matches = useLiveQuery(() => db.matches.where('sessionId').equals(session.id).toArray(), [session.id]);
  // Da co tran dau tien lan san -> nhung thong so dinh hinh lich khong duoc doi nua,
  // vi lich da xep va da co ket qua dua tren chung.
  const locked = !!matches?.some((m) => m.state !== 'queued');
  // Chi tinh nguoi DA TOI — day cung la nhung nguoi se duoc xep lich.
  const n = schedulablePlayerIds(session).length;
  const waiting = notSchedulable(session).length;
  const shape =
    n >= 4
      ? previewShape(n, {
          minPer: session.minPerPlayer,
          maxPer: session.maxPerPlayer,
          courtCount: session.courtCount,
        })
      : null;

  const estMin =
    session.format.type === 'points' ? (session.format.target === 21 ? 17.5 : 11.5) : session.format.minutes + 1.5;
  const capacity = Math.floor((session.durationMin * session.courtCount) / estMin);
  const requiredPace = shape ? (session.durationMin * session.courtCount) / shape.coreCount : 0;

  return (
    <div className="space-y-4 pb-6">
      {locked && (
        <Banner level="info">
          Buổi đã bắt đầu — <b>số sân</b> và <b>số trận tối thiểu / tối đa</b> đã khoá vì lịch đang chạy dựa trên
          chúng. Thời lượng, thể thức và giá tiền vẫn sửa được.
        </Banner>
      )}

      <Card className="space-y-3">
        <Field label="Sân / địa điểm">
          <TextInput value={session.venue} onChange={(e) => set({ venue: e.target.value })} placeholder="VD: Sân Hoàng Anh" />
        </Field>
        <Field label="Ngày">
          <TextInput type="date" value={session.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Số sân">
            <NumberInput value={session.courtCount} min={1} disabled={locked} onChange={(v) => set({ courtCount: v })} />
          </Field>
          <Field label="Thời lượng">
            <NumberInput value={session.durationMin} step={15} min={30} suffix="phút" onChange={(v) => set({ durationMin: v })} />
          </Field>
        </div>
        <Field label="Thể thức">
          <Select
            value={session.format.type === 'points' ? String(session.format.target) : 'timed'}
            onChange={(v) =>
              set({ format: v === 'timed' ? { type: 'timed', minutes: 10 } : { type: 'points', target: Number(v) as 15 | 21 } })
            }
            options={[
              { value: '21', label: '1 game 21 điểm (~16 phút)' },
              { value: '15', label: '1 game 15 điểm (~10 phút)' },
              { value: 'timed', label: 'Đánh theo giờ 10 phút' },
            ]}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tối thiểu / người">
            <NumberInput
              value={session.minPerPlayer}
              min={1}
              suffix="trận"
              disabled={locked}
              onChange={(v) => set({ minPerPlayer: v })}
            />
          </Field>
          <Field label="Tối đa / người">
            <NumberInput
              value={session.maxPerPlayer}
              min={session.minPerPlayer}
              suffix="trận"
              disabled={locked}
              onChange={(v) => set({ maxPerPlayer: Math.max(session.minPerPlayer, v) })}
            />
          </Field>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Máy tính khả thi</h2>
        {!shape ? (
          <Banner level="info">
            Cần ít nhất 4 người <b>đã tới</b> ở tab “Người” để tính được lịch.
            {waiting > 0 && ` Đang có ${waiting} người chưa tới / đang nghỉ, chưa được tính.`}
          </Banner>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Trận bắt buộc" value={shape.coreCount} hint="vạch 6 trận" />
              <Stat label="Trận tối đa" value={shape.totalCount} hint="nếu dư giờ" />
              <Stat label="Kịp được" value={capacity} hint="theo thể thức" />
            </div>
            <div className="text-sm text-slate-300">
              {n} người đã tới · mỗi người <b>{session.minPerPlayer}–{session.maxPerPlayer} trận</b> · cần{' '}
              <b>{requiredPace.toFixed(1)} phút/trận</b> để qua vạch.
            </div>
            {waiting > 0 && (
              <Banner level="info">
                {waiting} người chưa tới / đang nghỉ nên chưa có trong con số trên. Khi họ bấm “Đã tới”, app
                chèn họ vào lịch còn lại và tính lại vạch.
              </Banner>
            )}
            {capacity < shape.coreCount ? (
              <Banner level="danger">
                Không kịp: thể thức này chỉ cho ~{capacity} trận, cần {shape.coreCount}. Rút xuống 15 điểm, bớt người,
                thêm sân hoặc thêm giờ.
              </Banner>
            ) : (
              <Banner level="ok">
                Kịp {capacity} trận — vượt vạch {shape.coreCount}, ai cũng đủ {session.minPerPlayer} trận.
              </Banner>
            )}
            {shape.backToBackUnavoidable && (
              <Banner level="warn">
                Chỉ {n} người trên {session.courtCount} sân — không thể tránh việc có người đánh 2 trận liên tiếp.
                Thêm người để app giữ được khoảng nghỉ.
              </Banner>
            )}
          </>
        )}
      </Card>

      <Button
        variant="ghost"
        className="w-full"
        onClick={async () => {
          if (confirm('Xoá buổi này và toàn bộ lịch của nó?')) {
            await db.matches.where('sessionId').equals(session.id).delete();
            await db.sessions.delete(session.id);
            location.hash = '#/';
          }
        }}
      >
        Xoá buổi
      </Button>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-xl bg-panel2 p-3">
      <div className="text-2xl font-bold text-teal-300">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
      {hint && <div className="text-[10px] text-slate-500">{hint}</div>}
    </div>
  );
}
