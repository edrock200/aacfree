import { useEffect, useRef, useState } from 'react';

const COLORS = ['#1d1d1f', '#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#8e44ad', '#ffffff'];

/** Free drawing / handwriting pad. */
export function DrawTool() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(6);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = canvas.current!;
    const resize = () => {
      const r = c.getBoundingClientRect();
      const img = c.width ? c.getContext('2d')!.getImageData(0, 0, c.width, c.height) : null;
      c.width = r.width * devicePixelRatio;
      c.height = r.height * devicePixelRatio;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      if (img) ctx.putImageData(img, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) * devicePixelRatio, y: (e.clientY - r.top) * devicePixelRatio };
  };

  const line = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const ctx = canvas.current!.getContext('2d')!;
    ctx.strokeStyle = color;
    ctx.lineWidth = (color === '#ffffff' ? size * 4 : size) * devicePixelRatio;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };

  const clear = () => {
    const c = canvas.current!;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
  };

  return (
    <div className="draw">
      <div className="row draw-tools">
        {COLORS.map((c) => (
          <button key={c} className={`swatch ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c === '#ffffff' ? 'Eraser' : c}>{c === '#ffffff' ? '⌫' : ''}</button>
        ))}
        <input type="range" min={2} max={24} value={size} onChange={(e) => setSize(+e.target.value)} aria-label="Pen size" />
        <button className="btn" onClick={clear}>Clear</button>
      </div>
      <canvas
        ref={canvas}
        className="draw-canvas"
        onPointerDown={(e) => { drawing.current = true; last.current = pos(e); (e.target as HTMLElement).setPointerCapture(e.pointerId); line(last.current, last.current); }}
        onPointerMove={(e) => { if (!drawing.current || !last.current) return; const p = pos(e); line(last.current, p); last.current = p; }}
        onPointerUp={() => { drawing.current = false; last.current = null; }}
        onPointerCancel={() => { drawing.current = false; last.current = null; }}
      />
    </div>
  );
}
