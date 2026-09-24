import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import QrCode from '../components/QrCode';
import {
  Banner, Button, Card, Chip, ConfirmSheet, Field, IconButton, NumberInput, Select,
  Sheet, TextInput, toast,
} from '../components/ui';
import { db, getHostSettings, saveHostSettings } from '../db';
import { BANKS, bankByBin } from '../lib/banks';
import {
  computeMoney, femaleDiscountOf, formatVnd, payingAttendees, splitFees,
  FEE_MODE_LABEL, type FeeMode, type FeeShare, type Payer,
} from '../lib/money';
import { sachNoiDung, vietQrPayload } from '../lib/vietqr';
import type { HostSettings, Session } from '../types';

export default function MoneyTab({ session }: { session: Session }) {
  const players = useLiveQuery(() => db.players.toArray(), []) ?? [];
  const matches = useLiveQuery(
    () => db.matches.where('sessionId').equals(session.id).toArray(), [session.id],
  ) ?? [];
  const host = useLiveQuery(() => getHostSettings(), []);
  const byId = new Map(players.map((p) => [p.id, p]));
  const [target, setTarget] = useState(0);
  const [qrFor, setQrFor] = useState<FeeShare | null>(null);
  const [editBank, setEditBank] = useState(false);
  const [confirmApply, setConfirmApply] = useState<{ mode: FeeMode; profit: number } | null>(null);

  const m = computeMoney(session);
  const mode: FeeMode = session.feeMode ?? 'even';
  const discount = femaleDiscountOf(session);
  const set = (patch: Partial<Session>) => db.sessions.update(session.id, patch);

  // So tran da danh va so phut co mat cua tung nguoi — du lieu da co san.
  const done = matches.filter((x) => x.state === 'done');
  const demTran = new Map<string, number>();
  done.forEach((x) => [...x.teamA, ...x.teamB].forEach((id) => demTran.set(id, (demTran.get(id) ?? 0) + 1)));
  const ketThuc = session.startAt + session.durationMin * 60000;
  const payers: Payer[] = payingAttendees(session).map((a) => {
    const den = a.arrivedAt ?? session.startAt;
    const ve = a.leftAt ?? Math.min(Date.now(), ketThuc);
    return {
      playerId: a.playerId,
      female: byId.get(a.playerId)?.gender === 'F',
      matches: demTran.get(a.playerId) ?? 0,
      minutes: Math.max(0, Math.round((ve - den) / 60000)),
    };
  });

  const split = splitFees(session, payers, mode, 0);
  const splitLai = splitFees(session, payers, mode, target);
  const feeOf = (id: string) => session.attendees.find((a) => a.playerId === id)?.fee ?? 0;
  const lechKeHoach = split.shares.filter((x) => feeOf(x.playerId) !== x.fee).length;

  const applySplit = (r: ReturnType<typeof splitFees>) =>
    set({
      attendees: session.attendees.map((a) => {
        const s = r.shares.find((x) => x.playerId === a.playerId);
        return s ? { ...a, fee: s.fee } : a;
      }),
    });

  const setFee = (playerId: string, fee: number) =>
    set({ attendees: session.attendees.map((a) => (a.playerId === playerId ? { ...a, fee } : a)) });
  const togglePaid = (playerId: string) =>
    set({ attendees: session.attendees.map((a) => (a.playerId === playerId ? { ...a, paid: !a.paid } : a)) });

  const coTaiKhoan = !!(host?.bankBin && host?.accountNumber);

  return (
    <div className="space-y-4 pb-6">
      <Banner level={m.profit >= 0 ? 'ok' : 'danger'}>
        <div className="text-lg font-bold">
          {m.profit >= 0 ? 'Lãi' : 'Lỗ'} {formatVnd(Math.abs(m.profit))}
        </div>
        <div className="text-xs opacity-80">
          Thu {formatVnd(m.expected)} · Chi {formatVnd(m.totalCost)} ·{' '}
          {split.shares.filter((x) => !x.female).length} nam + {split.shares.filter((x) => x.female).length} nữ
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
        <h2 className="font-semibold">Cách chia tiền</h2>
        <div className="grid grid-cols-3 gap-2">
          {(['even', 'matches', 'time'] as FeeMode[]).map((k) => (
            <button key={k} onClick={() => set({ feeMode: k })}
              className={`rounded-xl border px-2 py-3 text-xs font-semibold ${
                mode === k ? 'border-teal-500 bg-teal-900/50 text-teal-200' : 'border-line bg-panel2 text-slate-300'
              }`}>
              {FEE_MODE_LABEL[k]}
            </button>
          ))}
        </div>
        {split.fellBack && mode !== 'even' && (
          <Banner level="warn">
            Chưa có số liệu để chia {FEE_MODE_LABEL[mode].toLowerCase()} — đang tạm chia đều.
          </Banner>
        )}

        <Field label="Nữ đóng ít hơn nam">
          <NumberInput value={discount} step={5000} onChange={(v) => set({ femaleDiscount: Math.max(0, v) })} suffix="đ" />
        </Field>
        {split.clamped && (
          <p className="text-xs text-amber-400">
            Không gánh nổi mức giảm {formatVnd(discount)} — app đang dùng {formatVnd(split.discount)}.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 text-center text-sm">
          <Box title={formatVnd(split.expected)} sub={`thu được · ${split.profit >= 0 ? 'dư' : 'thiếu'} ${formatVnd(Math.abs(split.profit))}`} />
          <Box title={formatVnd(splitLai.expected)} sub={`nếu muốn lãi ${formatVnd(target)}`} />
        </div>
        <NumberInput value={target} step={50000} onChange={setTarget} suffix="đ lãi" />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => setConfirmApply({ mode, profit: 0 })}>Áp mức hoà vốn</Button>
          <Button variant="ghost" onClick={() => setConfirmApply({ mode, profit: target })}>Áp mức có lãi</Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Nhận tiền chuyển khoản</h2>
          <button onClick={() => setEditBank(true)} className="text-sm font-semibold text-teal-300">
            {coTaiKhoan ? 'Đổi' : 'Cài đặt'}
          </button>
        </div>
        {coTaiKhoan ? (
          <p className="text-sm text-slate-300">
            {bankByBin(host!.bankBin!)?.ten} · {host!.accountNumber}
            {host?.accountName ? ` · ${host.accountName}` : ''}
            <br />
            <span className="text-xs text-slate-400">Bấm nút QR ở từng người để hiện mã đúng số tiền.</span>
          </p>
        ) : (
          <p className="text-sm text-slate-400">
            Nhập số tài khoản một lần, app sẽ sinh mã QR riêng cho từng người với đúng số tiền và nội dung.
          </p>
        )}
      </Card>

      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Thu tiền</h2>
          <Chip tone={m.outstanding ? 'amber' : 'emerald'}>
            {m.outstanding ? `còn ${formatVnd(m.outstanding)}` : 'đã thu đủ'}
          </Chip>
        </div>
        {!!lechKeHoach && (
          <p className="text-xs text-slate-400">
            {lechKeHoach} người đang thu khác mức tính ra. Bấm “Áp mức…” để đồng bộ.
          </p>
        )}
        {split.shares.map((s) => {
          const p = byId.get(s.playerId);
          const a = session.attendees.find((x) => x.playerId === s.playerId)!;
          return (
            <div key={s.playerId} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">
                  <span className={s.female ? 'text-pink-400' : 'text-sky-400'}>{s.female ? 'Nữ' : 'Nam'}</span>{' '}
                  {p?.name ?? '???'}
                </div>
                <div className="text-xs text-slate-400">
                  {s.matches} trận · {s.minutes}′{mode !== 'even' && ` · tính ${formatVnd(s.fee)}`}
                </div>
              </div>
              <input type="number" inputMode="numeric" value={a.fee}
                onChange={(e) => setFee(s.playerId, Number(e.target.value) || 0)}
                className="w-24 rounded-lg border border-line bg-panel2 px-2 py-2 text-right text-sm" />
              {coTaiKhoan && (
                <IconButton label={`Mã QR cho ${p?.name}`} onClick={() => setQrFor(s)}>
                  <QrGlyph />
                </IconButton>
              )}
              <button onClick={() => togglePaid(s.playerId)} className="h-11 shrink-0 px-1">
                <Chip tone={a.paid ? 'emerald' : 'slate'}>{a.paid ? 'Đã thu' : 'Chưa'}</Chip>
              </button>
            </div>
          );
        })}
        {!split.shares.length && <p className="text-sm text-slate-400">Chưa ai được đánh dấu “Đã tới” ở bước Người.</p>}
      </Card>

      {qrFor && host?.bankBin && host?.accountNumber && (
        <QrSheet session={session} name={byId.get(qrFor.playerId)?.name ?? ''}
                 bankBin={host.bankBin} account={host.accountNumber}
                 fee={session.attendees.find((a) => a.playerId === qrFor.playerId)?.fee ?? qrFor.fee}
                 onClose={() => setQrFor(null)} />
      )}

      {editBank && (
        <BankSheet initial={host ?? { key: 'host' }} onClose={() => setEditBank(false)}
          onSave={async (v) => { await saveHostSettings(v); setEditBank(false); toast('Đã lưu tài khoản nhận tiền.'); }} />
      )}

      {confirmApply && (
        <ConfirmSheet
          title="Áp mức thu này?"
          tone="primary"
          confirmLabel="Áp cho tất cả"
          onClose={() => setConfirmApply(null)}
          body={
            <>
              Ghi đè số tiền của <b>{split.shares.length} người</b> theo cách “
              {FEE_MODE_LABEL[confirmApply.mode]}”. Số bạn đã sửa tay sẽ mất.
            </>
          }
          onConfirm={async () => {
            const truoc = session.attendees.map((a) => ({ playerId: a.playerId, fee: a.fee }));
            const r = confirmApply.profit ? splitLai : split;
            setConfirmApply(null);
            await applySplit(r);
            toast(`Đã áp mức thu — tổng ${formatVnd(r.expected)}.`, {
              undo: async () => {
                await set({
                  attendees: session.attendees.map((a) => ({
                    ...a, fee: truoc.find((t) => t.playerId === a.playerId)?.fee ?? a.fee,
                  })),
                });
              },
            });
          }}
        />
      )}
    </div>
  );
}

function QrGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM19 19h2M14 21h3" />
    </svg>
  );
}

function QrSheet({
  session, name, bankBin, account, fee, onClose,
}: {
  session: Session; name: string;
  bankBin: string; account: string; fee: number; onClose: () => void;
}) {
  const noiDung = sachNoiDung(`Cau long ${session.date.slice(8, 10)}${session.date.slice(5, 7)} ${name}`);
  let payload = '';
  let loi = '';
  try {
    payload = vietQrPayload({ bankBin, accountNumber: account, amount: fee, message: noiDung });
  } catch (e) {
    loi = (e as Error).message;
  }
  return (
    <Sheet title={name} onClose={onClose}>
      {loi ? (
        <Banner level="danger">{loi} — sửa lại ở mục “Nhận tiền chuyển khoản”.</Banner>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <QrCode value={payload} size={240} />
          <div className="text-center">
            <div className="text-2xl font-bold text-teal-300">{formatVnd(fee)}</div>
            <div className="text-sm text-slate-300">{bankByBin(bankBin)?.ten} · {account}</div>
            <div className="mt-1 text-xs text-slate-400">Nội dung: {noiDung}</div>
          </div>
          <p className="text-center text-xs text-slate-400">
            Người chơi mở app ngân hàng, quét mã này là đã điền sẵn số tiền và nội dung.
          </p>
        </div>
      )}
    </Sheet>
  );
}

function BankSheet({
  initial, onClose, onSave,
}: {
  initial: Partial<HostSettings>;
  onClose: () => void;
  onSave: (v: { bankBin: string; accountNumber: string; accountName: string }) => void;
}) {
  const [bankBin, setBin] = useState(initial.bankBin ?? '970436');
  const [accountNumber, setSo] = useState(initial.accountNumber ?? '');
  const [accountName, setTen] = useState(initial.accountName ?? '');
  const ok = /^[0-9A-Za-z]{4,19}$/.test(accountNumber.replace(/\s/g, ''));
  return (
    <Sheet title="Tài khoản nhận tiền" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Ngân hàng">
          <Select value={bankBin} onChange={setBin}
                  options={BANKS.map((b) => ({ value: b.bin, label: b.ten }))} />
        </Field>
        <Field label="Số tài khoản">
          <TextInput value={accountNumber} inputMode="numeric" placeholder="0123456789"
                     onChange={(e) => setSo(e.target.value)} />
        </Field>
        <Field label="Tên chủ tài khoản" hint="Chỉ để bạn nhìn cho chắc, không nằm trong mã QR.">
          <TextInput value={accountName} placeholder="NGUYEN VAN A" onChange={(e) => setTen(e.target.value)} />
        </Field>
        {!ok && !!accountNumber && <p className="text-xs text-rose-400">Số tài khoản phải 4–19 chữ số.</p>}
        <p className="text-xs text-slate-400">
          Chỉ lưu trên máy này, nằm trong file sao lưu. Kiểm tra kỹ trước khi đưa mã cho người khác quét.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button disabled={!ok} onClick={() => onSave({ bankBin, accountNumber: accountNumber.replace(/\s/g, ''), accountName })}>
            Lưu
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function Box({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="rounded-xl bg-panel2 p-3">
      <div className="text-lg font-bold text-teal-300">{title}</div>
      <div className="text-xs text-slate-400">{sub}</div>
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
