import type { ReactNode } from 'react';

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
      className={`rounded-xl border px-4 py-3 font-semibold transition disabled:opacity-40 ${BTN[variant]} ${className}`}
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
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
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
          <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-slate-500">
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
