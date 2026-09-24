import { useSyncExternalStore, type ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-panel border border-line p-4 ${className}`}>{children}</div>
  );
}

type BtnVariant = 'primary' | 'ghost' | 'danger' | 'subtle';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-teal-600 active:bg-teal-700 text-white border-teal-500',
  ghost: 'bg-transparent text-slate-200 border-line active:bg-panel2',
  danger: 'bg-rose-600 active:bg-rose-700 text-white border-rose-500',
  subtle: 'bg-panel2 text-slate-100 border-line active:bg-line',
};

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled,
  className = '',
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border px-4 py-3 font-semibold transition disabled:opacity-55 ${BTN[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium tracking-wide text-slate-400 uppercase">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

const INPUT =
  'w-full rounded-xl border border-line bg-panel2 px-3 py-3 text-slate-100 outline-none focus:border-teal-500';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT} ${props.className ?? ''}`} />;
}

export function NumberInput({
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  suffix?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${disabled ? 'opacity-50' : ''}`}>
      <Button
        variant="subtle"
        className="w-10 shrink-0 px-0 py-3"
        disabled={disabled}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        −
      </Button>
      <div className="relative min-w-0 flex-1">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className={`${INPUT} text-center ${suffix ? 'pr-10' : ''} disabled:cursor-not-allowed`}
        />
        {suffix && (
          <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-slate-400">
            {suffix}
          </span>
        )}
      </div>
      <Button variant="subtle" className="w-10 shrink-0 px-0 py-3" disabled={disabled} onClick={() => onChange(value + step)}>
        +
      </Button>
    </div>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className={INPUT}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Banner({ level, children }: { level: 'ok' | 'warn' | 'danger' | 'info'; children: ReactNode }) {
  const tone = {
    ok: 'bg-emerald-950/60 border-emerald-700 text-emerald-200',
    warn: 'bg-amber-950/60 border-amber-700 text-amber-200',
    danger: 'bg-rose-950/60 border-rose-700 text-rose-200',
    info: 'bg-sky-950/60 border-sky-700 text-sky-200',
  }[level];
  return <div className={`rounded-xl border px-3 py-2 text-sm ${tone}`}>{children}</div>;
}

export function Chip({ children, tone = 'slate' }: { children: ReactNode; tone?: string }) {
  const map: Record<string, string> = {
    slate: 'bg-panel2 text-slate-300 border-line',
    teal: 'bg-teal-900/60 text-teal-200 border-teal-700',
    amber: 'bg-amber-900/60 text-amber-200 border-amber-700',
    rose: 'bg-rose-900/60 text-rose-200 border-rose-700',
    emerald: 'bg-emerald-900/60 text-emerald-200 border-emerald-700',
  };
  return (
    <span className={`inline-block rounded-lg border px-2 py-0.5 text-xs font-medium ${map[tone] ?? map.slate}`}>
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- icon
 * Icon SVG thay cho ky tu text (✎ ✕ ⋯ ‹). Net o moi co chu, xoay mau theo
 * currentColor, va quan trong nhat: vung bam khong phu thuoc co chu.
 */
type IconProps = { className?: string };
const svg = (d: ReactNode, extra = '') => ({ className = 'h-5 w-5' }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
       className={`${className} ${extra}`}>
    {d}
  </svg>
);

export const IconBack = svg(<path d="M15 18l-6-6 6-6" />);
export const IconCheck = svg(<path d="M20 6L9 17l-5-5" />);
export const IconLock = svg(<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>);
export const IconPencil = svg(<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>);
export const IconTrash = svg(<><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></>);
export const IconMore = svg(<><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></>);
export const IconPlus = svg(<><path d="M12 5v14" /><path d="M5 12h14" /></>);
export const IconPlay = svg(<path d="M6 4l14 8-14 8V4z" />);
export const IconUsers = svg(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M17 5.5a3.5 3.5 0 0 1 0 7" /><path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></>);
export const IconMale = svg(<><circle cx="10" cy="14" r="5.5" /><path d="M15 9l5-5" /><path d="M15 4h5v5" /></>);
export const IconFemale = svg(<><circle cx="12" cy="9" r="5.5" /><path d="M12 15v6" /><path d="M9 18h6" /></>);
export const IconArrowRight = svg(<><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>);

/** Nut chi co icon — luon >= 44x44 theo chuan vung bam cua Apple/Google. */
export function IconButton({
  label, onClick, children, tone = 'ghost', className = '',
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  tone?: 'ghost' | 'danger';
  className?: string;
}) {
  const t = tone === 'danger' ? 'text-rose-300 active:bg-rose-950' : 'text-slate-300 active:bg-panel2';
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${t} ${className}`}>
      {children}
    </button>
  );
}

/* --------------------------------------------------------------- sheet */

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-panel p-4"
           onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Đóng"
                  className="grid h-11 w-11 place-items-center rounded-xl text-slate-400 active:bg-panel2">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- toast
 * Thanh thong bao + HOAN TAC. Ly do ton tai: cac thao tac lam mat du lieu
 * (bo nguoi khoi buoi, ket thuc tran) truoc day khong the lay lai.
 */
export interface ToastItem {
  id: number;
  text: string;
  tone: 'ok' | 'warn' | 'danger';
  undo?: () => void | Promise<void>;
}

let items: ToastItem[] = [];
let seq = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const snapshot = () => items;
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function toast(text: string, opts: { tone?: ToastItem['tone']; undo?: ToastItem['undo'] } = {}) {
  const id = ++seq;
  items = [...items, { id, text, tone: opts.tone ?? 'ok', undo: opts.undo }];
  emit();
  // Co nut hoan tac thi de lau hon, du thoi gian doc va bam.
  setTimeout(() => dismiss(id), opts.undo ? 7000 : 4000);
  return id;
}

export function Toaster() {
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);
  if (!list.length) return null;
  const tone = {
    ok: 'border-teal-700 bg-teal-950/95 text-teal-100',
    warn: 'border-amber-700 bg-amber-950/95 text-amber-100',
    danger: 'border-rose-700 bg-rose-950/95 text-rose-100',
  };
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-60 mx-auto flex max-w-lg flex-col gap-2 px-4">
      {list.map((t) => (
        <div key={t.id}
             className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-3 py-2 shadow-lg backdrop-blur ${tone[t.tone]}`}>
          <span className="min-w-0 flex-1 text-sm">{t.text}</span>
          {t.undo && (
            <button onClick={async () => { dismiss(t.id); await t.undo!(); }}
                    className="shrink-0 rounded-lg px-3 py-2 text-sm font-bold underline underline-offset-2">
              Hoàn tác
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ step bar */

export interface StepView {
  key: string;
  index: number;
  label: string;
  done: boolean;
  locked: boolean;
}

/**
 * Thanh 4 buoc o day man hinh. Dat o DAY chu khong phai dinh vi day la app
 * dung mot tay ngay tai san — ngon cai voi toi day de hon voi toi dinh.
 */
export function StepBar({
  steps, active, onPick,
}: {
  steps: StepView[];
  active: string;
  onPick: (key: string) => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-lg border-t border-line bg-panel/95 backdrop-blur">
      {steps.map((s) => {
        const on = s.key === active;
        return (
          <button key={s.key} onClick={() => onPick(s.key)}
            aria-current={on ? 'step' : undefined}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 ${
              on ? 'text-teal-300' : s.locked ? 'text-slate-400' : 'text-slate-400'
            }`}>
            <span className={`grid h-7 w-7 place-items-center rounded-full border text-xs font-bold ${
              on ? 'border-teal-400 bg-teal-500/20'
                 : s.done ? 'border-emerald-600 bg-emerald-900/40 text-emerald-300'
                 : s.locked ? 'border-line bg-panel2'
                 : 'border-line bg-panel2'
            }`}>
              {s.locked ? <IconLock className="h-3.5 w-3.5" />
                        : s.done && !on ? <IconCheck className="h-4 w-4" />
                        : s.index}
            </span>
            <span className="text-[11px] font-semibold">{s.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/**
 * Hop xac nhan NAM TRONG APP. Khong dung confirm() cua trinh duyet: no co the
 * bi chan va tra ve false, luc do thao tac im lang khong xay ra gi ca.
 */
export function ConfirmSheet({
  title, body, confirmLabel, onConfirm, onClose, tone = 'danger',
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  tone?: 'danger' | 'primary';
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="space-y-4">
        <div className="text-sm text-slate-300">{body}</div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={onClose}>Huỷ</Button>
          <Button variant={tone} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </Sheet>
  );
}
