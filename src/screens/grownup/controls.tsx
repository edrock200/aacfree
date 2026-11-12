import type { ReactNode } from 'react';

export function Toggle({ label, hint, checked, onChange }: { label: ReactNode; hint?: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="setting toggle">
      <span className="setting-text"><b>{label}</b>{hint && <small>{hint}</small>}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden />
    </label>
  );
}

export function Slider({ label, hint, value, min, max, step = 1, onChange, format }: {
  label: ReactNode; hint?: ReactNode; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <label className="setting slider">
      <span className="setting-text"><b>{label}</b>{hint && <small>{hint}</small>}</span>
      <span className="slider-row">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <output>{format ? format(value) : value}</output>
      </span>
    </label>
  );
}

export function Choice<T extends string | number>({ label, hint, value, options, onChange }: {
  label: ReactNode; hint?: ReactNode; value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="setting choice">
      <span className="setting-text"><b>{label}</b>{hint && <small>{hint}</small>}</span>
      <div className="seg">
        {options.map((o) => (
          <button key={String(o.value)} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

export function Section({ title, children, intro }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section className="gu-section">
      <h3>{title}</h3>
      {intro && <p className="muted">{intro}</p>}
      {children}
    </section>
  );
}
