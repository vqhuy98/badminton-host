import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Banner, Button, Card, Chip, Field, NumberInput } from '../components/ui';
import { db } from '../db';
import {
  computeMoney,
  feePlan,
  femaleDiscountOf,
  formatVnd,
  payingAttendees,
  type FeePlan,
} from '../lib/money';
import type { Gender, Session } from '../types';

export default function MoneyTab({ session }: { session: Session }) {
  const players = useLiveQuery(() => db.players.toArray(), []) ?? [];
  const byId = new Map(players.map((p) => [p.id, p]));
  const genderOf = (id: string): Gender | undefined => byId.get(id)?.gender;
  const [target, setTarget] = useState(0);
  const m = computeMoney(session);
  const discount = femaleDiscountOf(session);
  const evenPlan = feePlan(session, genderOf, 0);
  const profitPlan = feePlan(session, genderOf, target);
  const set = (patch: Partial<Session>) => db.sessions.update(session.id, patch);

  const setFee = (playerId: string, fee: number) =>
    set({ attendees: session.attendees.map((a) => (a.playerId === playerId ? { ...a, fee } : a)) });
  const togglePaid = (playerId: string) =>
    set({ attendees: session.attendees.map((a) => (a.playerId === playerId ? { ...a, paid: !a.paid } : a)) });
  /** Ap muc thu theo gioi tinh cho tat ca — nam mot gia, nu mot gia. */
  const applyPlan = (p: FeePlan) =>
    set({
      defaultFee: p.male,
      attendees: session.attendees.map((a) => ({ ...a, fee: genderOf(a.playerId) === 'F' ? p.female : p.male })),
    });

  const paying = payingAttendees(session);
  const offPlan = paying.filter(
    (a) => a.fee !== (genderOf(a.playerId) === 'F' ? evenPlan.female : evenPlan.male),
  ).length;

  return (
    <div className="space-y-4 pb-6">
      <Banner level={m.profit >= 0 ? 'ok' : 'danger'}>
        <div className="text-lg font-bold">
          {m.profit >= 0 ? 'Lãi' : 'Lỗ'} {formatVnd(Math.abs(m.profit))}
        </div>
        <div className="text-xs opacity-80">
          Thu {formatVnd(m.expected)} · Chi {formatVnd(m.totalCost)} · {evenPlan.males} nam + {evenPlan.females} nữ ·{' '}
          {formatVnd(m.costPerHead)}/người
        </div>
      </Banner>

      <Card className="space-y-3">
        <h2 className="font-semibold">Chi phí</h2>
        <Field label="Giá sân / giờ">
          <NumberInput value={session.courtPricePerHour} step={10000} onChange={(v) => set({ courtPricePerHour: v })} suffix="đ" />
        </Field>
        <Field label="Giá cầu / quả">
          <NumberInput value={session.shuttlePrice} step={5000} onChange={(v) => set({ shuttlePrice: v })} suffix="đ" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cầu mang ra">
            <NumberInput value={session.shuttlesOut} onChange={(v) => set({ shuttlesOut: v })} suffix="quả" />
          </Field>
          <Field label="Cầu còn lại">
            <NumberInput value={session.shuttlesBack} onChange={(v) => set({ shuttlesBack: v })} suffix="quả" />
          </Field>
        </div>
        <dl className="space-y-1 text-sm">
          <Row k={`Tiền sân (${session.courtCount} sân × ${(session.durationMin / 60).toFixed(1)}h)`} v={formatVnd(m.courtCost)} />
          <Row k={`Tiền cầu (${m.shuttlesUsed} quả đã dùng)`} v={formatVnd(m.shuttleCost)} />
          {!!m.otherCost && <Row k="Chi khác" v={formatVnd(m.otherCost)} />}
          <Row k="Tổng chi" v={formatVnd(m.totalCost)} bold />
        </dl>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Mức thu</h2>

        <Field label="Nữ đóng ít hơn nam">
          <NumberInput value={discount} step={5000} onChange={(v) => set({ femaleDiscount: Math.max(0, v) })} suffix="đ" />
        </Field>
        <div className="flex flex-wrap gap-2">
          {[0, 10000, 20000, 30000].map((v) => (
            <button key={v} onClick={() => set({ femaleDiscount: v })}>
              <Chip tone={discount === v ? 'emerald' : 'slate'}>{v ? `-${v / 1000}k` : 'bằng nhau'}</Chip>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 text-center text-sm">
          <PlanBox plan={evenPlan} caption="thấp nhất, không lỗ" />
          <PlanBox plan={profitPlan} caption={`để lãi ${formatVnd(target)}`} />
        </div>
        {!!paying.length && (
          <p className="text-xs text-slate-500">
            Mức thấp nhất thu được {formatVnd(evenPlan.expected)} / chi {formatVnd(m.totalCost)}
            {evenPlan.profit > 0 ? ` — dư ${formatVnd(evenPlan.profit)} do làm tròn lên 5.000.` : '.'}
          </p>
        )}
        <NumberInput value={target} step={50000} onChange={setTarget} suffix="đ lãi" />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => applyPlan(evenPlan)}>
            Áp mức hoà vốn
          </Button>
          <Button variant="ghost" onClick={() => applyPlan(profitPlan)}>
            Áp mức có lãi
          </Button>
        </div>

        {evenPlan.clamped && (
          <p className="text-xs text-amber-400">
            Ít nam quá nên không gánh nổi mức giảm {formatVnd(discount)} — app đang dùng mức giảm{' '}
            {formatVnd(evenPlan.discount)}.
          </p>
        )}
        {!evenPlan.females && !!paying.length && (
          <p className="text-xs text-slate-500">Buổi này chưa có nữ nào đã tới — mọi người thu bằng nhau.</p>
        )}
        {!evenPlan.males && !!evenPlan.females && (
          <p className="text-xs text-slate-500">Toàn nữ — không có ai để chênh lệch, thu đều đầu người.</p>
        )}
      </Card>

      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Thu tiền</h2>
          <Chip tone={m.outstanding ? 'amber' : 'emerald'}>
            {m.outstanding ? `còn ${formatVnd(m.outstanding)}` : 'đã thu đủ'}
          </Chip>
        </div>
        {!!offPlan && (
          <p className="text-xs text-slate-500">
            {offPlan} người đang thu khác mức hoà vốn (sửa tay hoặc đổi giới tính sau khi áp). Bấm “Áp mức…” để đồng bộ
            lại.
          </p>
        )}
        {paying.map((a) => {
          const p = byId.get(a.playerId);
          const female = p?.gender === 'F';
          return (
            <div key={a.playerId} className="flex items-center gap-2">
              <span className={`w-6 shrink-0 text-center text-xs ${female ? 'text-pink-400' : 'text-sky-400'}`}>
                {female ? 'Nữ' : 'Nam'}
              </span>
              <span className="flex-1 truncate text-sm">{p?.name ?? '???'}</span>
              <input
                type="number"
                inputMode="numeric"
                value={a.fee}
                onChange={(e) => setFee(a.playerId, Number(e.target.value) || 0)}
                className="w-28 rounded-lg border border-line bg-panel2 px-2 py-2 text-right text-sm"
              />
              <button onClick={() => togglePaid(a.playerId)}>
                <Chip tone={a.paid ? 'emerald' : 'slate'}>{a.paid ? 'Đã thu' : 'Chưa'}</Chip>
              </button>
            </div>
          );
        })}
        {!paying.length && <p className="text-sm text-slate-500">Chưa ai được đánh dấu “Đã tới” ở tab Người.</p>}
      </Card>
    </div>
  );
}

function PlanBox({ plan, caption }: { plan: FeePlan; caption: string }) {
  const split = plan.discount > 0;
  return (
    <div className="rounded-xl bg-panel2 p-3">
      {split ? (
        <div className="flex items-baseline justify-center gap-2">
          <span className="text-lg font-bold text-sky-300">{formatVnd(plan.male)}</span>
          <span className="text-slate-600">/</span>
          <span className="text-lg font-bold text-pink-300">{formatVnd(plan.female)}</span>
        </div>
      ) : (
        <div className="text-lg font-bold text-teal-300">{formatVnd(plan.male)}</div>
      )}
      <div className="text-xs text-slate-400">{split ? `nam / nữ · ${caption}` : caption}</div>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'border-t border-line pt-1 font-semibold' : 'text-slate-400'}`}>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
