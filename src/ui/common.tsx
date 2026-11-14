import { useEffect, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import type { Builder } from '../content/types';
import { IconClose } from './icons';

// ─── Toasts ───

interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'error' | 'info';
}
export const useToasts = create<{ toasts: Toast[]; push: (text: string, kind?: Toast['kind']) => number; dismiss: (id: number) => void }>((set, get) => ({
  toasts: [],
  push: (text, kind = 'info') => {
    const id = Date.now() + Math.random();
    set({ toasts: [...get().toasts, { id, text, kind }].slice(-3) });
    setTimeout(() => get().dismiss(id), kind === 'error' ? 7000 : 3500);
    return id;
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
export const toast = (text: string, kind?: Toast['kind']) => useToasts.getState().push(text, kind);
export const dismissToast = (id: number) => useToasts.getState().dismiss(id);

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ─── Modal ───

export function Modal({ title, children, footer, onClose, wide }: { title: string; children: ReactNode; footer?: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Close">
            <IconClose size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/** Click an image to see it full size. */
export function ZoomImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <img src={src} alt={alt} className={className} onClick={() => setOpen(true)} />
      {open && (
        <div className="modal-back" onClick={() => setOpen(false)}>
          <img src={src} alt={alt} className="img-zoom" />
        </div>
      )}
    </>
  );
}

// ─── Text with bullets ───

/** Renders guidance text: lines starting with "- " become bullet lists. */
export function Detail({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = (key: number) => {
    if (bullets.length) {
      blocks.push(
        <ul key={`u${key}`}>
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };
  text.split('\n').forEach((line, i) => {
    if (line.startsWith('- ')) bullets.push(line.slice(2));
    else {
      flush(i);
      if (line.trim()) blocks.push(<p key={i}>{line}</p>);
    }
  });
  flush(-1);
  return <div className="detail">{blocks}</div>;
}

// ─── Inputs ───

export function NumberInput({ value, onChange, unit, disabled, placeholder, id, ariaLabel }: { value: string; onChange: (v: string) => void; unit?: string; disabled?: boolean; placeholder?: string; id?: string; ariaLabel?: string }) {
  const input = (
    <input
      id={id}
      className="input"
      inputMode="decimal"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
    />
  );
  if (!unit) return input;
  return (
    <div className="unit-wrap">
      {input}
      <span className="unit">{unit}</span>
    </div>
  );
}

export function YesNo({ value, onChange, disabled, label }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      <button type="button" className={value ? 'on' : ''} disabled={disabled} onClick={() => onChange(true)} aria-pressed={value}>
        Yes
      </button>
      <button type="button" className={!value ? 'on' : ''} disabled={disabled} onClick={() => onChange(false)} aria-pressed={!value}>
        No
      </button>
    </div>
  );
}

export function BuilderLogo({ builder }: { builder: Builder | undefined }) {
  if (!builder) return null;
  return (
    <div className="builder-logo">
      {builder.logo ? <img src={builder.logo} alt={`${builder.name} logo`} /> : <span className="text-logo">{builder.shortName}</span>}
    </div>
  );
}

export function timeAgo(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return `${h} h ago`;
}

/** Re-render every `ms` (for "saved 3 min ago"). */
export function useTick(ms: number) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

/** Shrink photos before they go into the file (keeps .chck files small). */
export async function readPhoto(file: File, maxSide = 1600): Promise<{ name: string; mime: string; dataUrl: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d')!;
    // JPEG has no transparency: paint white first so transparent PNGs do not turn black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { name: file.name, mime: 'image/jpeg', dataUrl: canvas.toDataURL('image/jpeg', 0.85) };
  } finally {
    URL.revokeObjectURL(url);
  }
}
