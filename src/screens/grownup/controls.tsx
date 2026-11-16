import { useId, useState, type ReactNode } from 'react';
import { t } from '../../i18n';

export function Toggle({ label, hint, checked, onChange }: { label: ReactNode; hint?: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="setting toggle">
      <span className="setting-text"><b>{label}</b>{hint && <small>{hint}</small>}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden />
    </label>
  );
}

/**
 * A setting slider that only takes effect when saved: dragging (or brushing it while scrolling) changes a
 * draft value, and Save / Cancel appear until the change is confirmed. Vertical swipes scroll the page
 * instead of moving the slider (touch-action: pan-y).
 */
export function Slider({ label, hint, value, min, max, step = 1, onChange, format }: {
  label: ReactNode; hint?: ReactNode; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string;
}) {
  const id = useId();
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? value;
  const dirty = draft !== null && draft !== value;
  const show = (v: number) => (format ? format(v) : String(v));
  return (
    <div className={`setting slider ${dirty ? 'dirty' : ''}`}>
      <label className="setting-text" htmlFor={id}><b>{label}</b>{hint && <small>{hint}</small>}</label>
      <span className="slider-row">
        <input id={id} type="range" min={min} max={max} step={step} value={shown} onChange={(e) => setDraft(Number(e.target.value))} />
        <output htmlFor={id}>{show(shown)}</output>
      </span>
      {dirty && (
        <span className="slider-save" role="group" aria-label={t('Unsaved change')}>
          <small className="muted">{t('Was {v}', { v: show(value) })}</small>
          <button type="button" className="btn small" onClick={() => setDraft(null)}>{t('Cancel')}</button>
          <button type="button" className="btn small primary" onClick={() => { onChange(draft); setDraft(null); }}>{t('Save')}</button>
        </span>
      )}
    </div>
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
