import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useStore, useProfile } from '../store';
import { Modal } from './Modal';
import { Symbol } from './Symbol';
import { SymbolPicker } from './SymbolPicker';
import { WORD_COLORS } from '../lib/colors';
import { suggestSymbol } from '../lib/library';
import { boardPaths, placeFolder } from '../lib/boards';
import { builtInKey } from '../lib/translate';
import { addSnapshot, putAsset } from '../lib/db';
import { buildProfile } from '../data/defaults';
import { clamp, uid } from '../lib/util';
import { MAX_COLS, MAX_ROWS } from '../lib/validate';
import {
  cellRect, detectGrid, EMPTY_INK, GOOD_LABEL, inkFraction, isEmptyCell, labelOf, pictureRect, tileBounds, tileColor,
  wordTypeForColor, type Rect, type RGB, type RGBAImage,
} from '../lib/boardimport';
import type { Reader } from '../lib/ocr';
import type { AACButton, Board, Cell, SymbolLibrary, WordType } from '../types';
import { IconCamera } from './Icons';
import { t, type Lang } from '../i18n';

/**
 * "Import a board from a picture": a photo or screenshot of a board in another AAC app (or on
 * paper) becomes a AACFree board with the same grid and the same word in every position, so the
 * person's motor plan carries over. Everything happens on this device: the grid is found by
 * src/lib/boardimport.ts and the words are read by on-device OCR (src/lib/ocr.ts, loaded only here).
 */

export const IMPORT_SNAPSHOT_REASON = 'Before importing a board from a picture';

/** Longest side of the picture kept for reading words, and of the copy used to find the grid. */
const FULL_MAX = 2400;
const SMALL_MAX = 900;

interface Picture {
  full: HTMLCanvasElement;
  small: RGBAImage;
  url: string;
  aspect: number;
}

/** The grid area as fractions of the picture (0…1), plus rows and columns. */
interface GridBox { x: number; y: number; w: number; h: number; rows: number; cols: number }

interface ImportCell {
  word: string;
  ink: number;
  type: WordType;
  /** AACFree's own picture for the word (bundled ARASAAC / library). */
  symbol?: string;
  /** The family chose this picture themselves (a new word then keeps it). */
  symbolChosen?: boolean;
  /** The picture cut from the screenshot. */
  crop?: { blob: Blob; url: string };
  useCrop: boolean;
  empty: boolean;
  folder: boolean;
}

type Step = 'pick' | 'grid' | 'reading' | 'preview';

async function loadPicture(file: Blob): Promise<Picture> {
  const src: ImageBitmap | HTMLImageElement = await createImageBitmap(file).catch(async () => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    return img;
  });
  const w = src.width, h = src.height;
  if (!w || !h) throw new Error('empty image');
  const draw = (max: number) => {
    const s = Math.min(1, max / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * s));
    c.height = Math.max(1, Math.round(h * s));
    c.getContext('2d')!.drawImage(src as CanvasImageSource, 0, 0, c.width, c.height);
    return c;
  };
  const full = draw(FULL_MAX);
  const sc = draw(SMALL_MAX);
  const small = sc.getContext('2d')!.getImageData(0, 0, sc.width, sc.height);
  const blob = await new Promise<Blob | null>((r) => full.toBlob(r, 'image/jpeg', 0.9));
  if ('close' in src) src.close();
  return { full, small: { width: small.width, height: small.height, data: small.data }, url: URL.createObjectURL(blob ?? file), aspect: w / h };
}

/** Copy part of a canvas into a new one, scaled. */
function cropCanvas(from: HTMLCanvasElement, r: Rect, scale: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(r.w * scale));
  c.height = Math.max(1, Math.round(r.h * scale));
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(from, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
  return c;
}

const toBlob = (c: HTMLCanvasElement) => new Promise<Blob | null>((r) => c.toBlob(r, 'image/webp', 0.85));

const areaIn = (g: GridBox, width: number, height: number): Rect => ({ x: g.x * width, y: g.y * height, w: g.w * width, h: g.h * height });

/** Read one cell: is it empty, which word, which colour, and its picture. */
async function readCell(pic: Picture, g: GridBox, bg: RGB, r: number, c: number, reader: Reader, lang: Lang, library: SymbolLibrary | undefined): Promise<ImportCell> {
  const smallArea = areaIn(g, pic.small.width, pic.small.height);
  const ink = inkFraction(pic.small, cellRect(smallArea, g.rows, g.cols, r, c, 0.12), bg);
  const colourType = wordTypeForColor(tileColor(pic.small, cellRect(smallArea, g.rows, g.cols, r, c, 0.1), bg));
  if (ink < EMPTY_INK) return { word: '', ink, type: colourType ?? 'noun', useCrop: false, empty: true, folder: false };

  // Read the words from the full-size picture, inside the tile itself (found in the cell, so a grid
  // line that is a little off does not matter), keeping clear of its edge: an outline reads as "I" or "|".
  const fullArea = areaIn(g, pic.full.width, pic.full.height);
  const k = pic.full.width / pic.small.width;
  const tile = tileBounds(pic.small, cellRect(smallArea, g.rows, g.cols, r, c, -0.04), bg);
  const inner = tile
    ? cellRect({ x: tile.x * k, y: tile.y * k, w: tile.w * k, h: tile.h * k }, 1, 1, 0, 0, 0.05)
    : cellRect(fullArea, g.rows, g.cols, r, c, 0.06);
  /** OCR one part of the picture; line boxes come back in picture coordinates. */
  const readPart = async (part: Rect, target: number) => {
    const scale = clamp(target / Math.max(1, Math.min(part.w, part.h)), 0.5, 4);
    const crop = cropCanvas(pic.full, part, scale);
    const { lines } = await reader.read(crop);
    return lines
      // Tall, thin "lines" are a tile edge or divider read as "I", "l" or "|".
      .filter((l) => !(l.box.h > crop.height * 0.4 && l.box.h > l.box.w * 3))
      .map((l) => ({ ...l, box: { x: part.x + l.box.x / scale, y: part.y + l.box.y / scale, w: l.box.w / scale, h: l.box.h / scale } }));
  };
  const known = (w: string) => !!suggestSymbol(library, w);
  let best = labelOf(await readPart(inner, 320), lang, known);
  if (best.score < GOOD_LABEL) {
    // Not sure yet: labels sit at the top or the bottom of a tile, so read those strips on their own
    // (a busy picture next to the word can hide it from a whole-tile read).
    const band = inner.h * 0.34;
    for (const part of [{ ...inner, h: band }, { ...inner, y: inner.y + inner.h - band, h: band }]) {
      const l = labelOf(await readPart(part, 120), lang, known);
      if (l.score > best.score) best = l;
    }
  }
  const word = best.text;
  const textBox = best.line?.box ?? null;
  const picRect = pictureRect(inner, textBox);
  const pr = cellRect(picRect, 1, 1, 0, 0, 0.04);
  const cropScale = Math.min(1, 256 / Math.max(pr.w, pr.h));
  const blob = await toBlob(cropCanvas(pic.full, pr, cropScale));
  const hit = suggestSymbol(library, word);
  return {
    word,
    ink,
    type: colourType ?? hit?.type ?? 'noun',
    symbol: hit?.symbol,
    crop: blob ? { blob, url: URL.createObjectURL(blob) } : undefined,
    useCrop: false,
    empty: isEmptyCell(word, ink),
    folder: false,
  };
}

export function BoardImport({ parentBoardId, onClose, onCreated }: {
  parentBoardId?: string; onClose: () => void; onCreated?: (boardId: string) => void;
}) {
  const p = useProfile();
  const library = useStore((s) => s.data.library);
  const lang = (p.settings.language ?? 'en') as Lang;
  const [step, setStep] = useState<Step>('pick');
  const [pic, setPic] = useState<Picture | null>(null);
  const [grid, setGrid] = useState<GridBox | null>(null);
  const [found, setFound] = useState(true);
  const [bg, setBg] = useState<RGB>([255, 255, 255]);
  const [cells, setCells] = useState<ImportCell[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number; loading: boolean }>({ done: 0, total: 0, loading: true });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [name, setName] = useState(t('Board from a picture'));
  const [mode, setMode] = useState<'folder' | 'profile'>('folder');
  const stack = useStore((s) => s.boardStack);
  const [parent, setParent] = useState(() => {
    const cur = parentBoardId ?? stack[stack.length - 1];
    return cur && p.boards[cur] ? cur : p.rootId;
  });
  const reader = useRef<Reader | null>(null);
  const cancelled = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);

  // Free the worker and the picture URLs when the dialog closes.
  useEffect(() => () => {
    cancelled.current = true;
    reader.current?.terminate().catch(() => {});
    urls.current.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const choose = async (f?: File | null) => {
    if (!f) return;
    setError('');
    setBusy(true);
    try {
      const picture = await loadPicture(f);
      urls.current.push(picture.url);
      const d = detectGrid(picture.small);
      const W = picture.small.width, H = picture.small.height;
      setPic(picture);
      setBg(d.background);
      setFound(d.found);
      setGrid({ x: d.area.x / W, y: d.area.y / H, w: d.area.w / W, h: d.area.h / H, rows: clamp(d.rows, 1, MAX_ROWS), cols: clamp(d.cols, 1, MAX_COLS) });
      setStep('grid');
    } catch (e) {
      console.warn('picture import: could not open the picture', e);
      setError(t('Could not read that image.'));
    } finally {
      setBusy(false);
    }
  };

  const read = async () => {
    if (!pic || !grid) return;
    cancelled.current = false;
    setError('');
    setStep('reading');
    const total = grid.rows * grid.cols;
    setProgress({ done: 0, total, loading: true });
    let r0: Reader | null = null;
    try {
      const { createReader } = await import('../lib/ocr');
      if (cancelled.current) return;
      r0 = await createReader(lang);
      reader.current = r0;
      setProgress({ done: 0, total, loading: false });
      const out: ImportCell[] = [];
      for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
          if (cancelled.current) return;
          const cell = await readCell(pic, grid, bg, r, c, r0, lang, library);
          if (cell.crop) urls.current.push(cell.crop.url);
          out.push(cell);
          setProgress({ done: out.length, total, loading: false });
        }
      }
      if (cancelled.current) return;
      setCells(out);
      setStep('preview');
    } catch (e) {
      if (cancelled.current) return;
      console.warn('picture import: reading failed', e);
      setError(t('Could not read the words. Check the grid and try again.'));
      setStep('grid');
    } finally {
      r0?.terminate().catch(() => {});
      if (reader.current === r0) reader.current = null;
    }
  };

  const cancelReading = () => {
    cancelled.current = true;
    reader.current?.terminate().catch(() => {});
    reader.current = null;
    setStep('grid');
  };

  const setCell = (i: number, patch: Partial<ImportCell>) => setCells((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const allCrops = cells.some((c) => !c.empty && c.crop) && cells.every((c) => c.empty || !c.crop || c.useCrop);
  const setAllCrops = (on: boolean) => setCells((cs) => cs.map((c) => ({ ...c, useCrop: on && !!c.crop })));
  const words = cells.filter((c) => !c.empty && c.word.trim()).length;
  const noWord = cells.filter((c) => !c.empty && !c.word.trim()).length;

  const save = async () => {
    if (!grid || busy) return;
    const label = name.trim() || t('Board from a picture');
    setBusy(true);
    const st = useStore.getState();
    try {
      if (mode === 'folder') {
        // The snapshot comes first: nothing is imported without it.
        await addSnapshot(st.data, IMPORT_SNAPSHOT_REASON);
      }
      const id = uid('board-');
      const subBoards: Board[] = [];
      const out: Cell[] = [];
      for (const c of cells) {
        const word = c.word.trim();
        if (c.empty || !word) { out.push(null); continue; }
        let symbol = c.symbol;
        if (c.useCrop && c.crop) {
          const assetId = uid('photo-');
          await putAsset(assetId, c.crop.blob);
          symbol = `img:${assetId}`;
        }
        const b: AACButton = { id: uid('b'), label: word, type: c.folder ? 'folder' : c.type };
        if (symbol) b.symbol = symbol;
        const key = c.folder ? undefined : builtInKey(word, lang);
        if (key) b.key = key;
        if (c.folder) {
          const sub: Board = { id: uid('board-'), name: word, cols: grid.cols, rows: grid.rows, cells: Array(grid.cols * grid.rows).fill(null) };
          if (symbol) sub.symbol = symbol;
          subBoards.push(sub);
          b.link = sub.id;
        }
        out.push(b);
      }
      const icon = suggestSymbol(library, label)?.symbol;
      const board: Board = { id, name: label, cols: grid.cols, rows: grid.rows, cells: out };
      if (icon) board.symbol = icon;

      if (mode === 'folder') {
        const folder: AACButton = { id: uid('b'), label, type: 'folder', link: id };
        if (icon) folder.symbol = icon;
        let placedOn = '';
        const before = st.profile().boards;
        st.updateProfile((pp) => {
          pp.boards[id] = board;
          for (const sb of subBoards) pp.boards[sb.id] = sb;
          placedOn = placeFolder(pp, parent, folder).name;
        }, { undoable: true });
        st.showToast(t('“{v0}” added to {v1}', { v0: label, v1: placedOn }), {
          label: t('Undo'),
          run: () => {
            const s2 = useStore.getState();
            if (s2.undo[s2.undo.length - 1]?.boards === before) s2.undoEdit();
          },
        });
        onCreated?.(id);
      } else {
        // A new profile whose Home is the imported board (like an OBF import), with this device's settings.
        const np = buildProfile(label, 'medium', lang);
        np.settings = { ...p.settings };
        np.boards = { [id]: board, ...Object.fromEntries(subBoards.map((sb) => [sb.id, sb])) };
        np.rootId = id;
        np.name = label;
        await st.replaceData({ ...st.data, profiles: [...st.data.profiles, np], activeProfileId: np.id }, IMPORT_SNAPSHOT_REASON);
        st.showToast(t('Imported “{v0}” as a new profile', { v0: label }));
      }
      onClose();
    } catch (e) {
      console.warn('picture import: save failed', e);
      setError(t('Could not save a snapshot, so nothing was imported. Try again, or save a backup file first.'));
      setBusy(false);
    }
  };

  const paths = useMemo(() => boardPaths(p), [p]);
  const boards = Object.values(p.boards).sort((a, b) => (paths[a.id]?.length ?? 99) - (paths[b.id]?.length ?? 99) || a.name.localeCompare(b.name));

  const footer = (
    <>
      {step === 'grid' && <button className="btn" data-scan-item onClick={() => { setStep('pick'); setPic(null); }}>{t('Another picture')}</button>}
      {step === 'preview' && <button className="btn" data-scan-item onClick={() => setStep('grid')}>{t('Back to the grid')}</button>}
      <span className="spacer" />
      {step === 'reading'
        ? <button className="btn" data-scan-item onClick={cancelReading}>{t('Cancel')}</button>
        : <button className="btn" data-scan-item onClick={onClose}>{t('Cancel')}</button>}
      {step === 'grid' && <button className="btn primary bi-read" data-scan-item onClick={read}>{t('Read the words')}</button>}
      {step === 'preview' && <button className="btn primary bi-save" data-scan-item disabled={busy || words === 0} onClick={save}>{t('Save board')}</button>}
    </>
  );

  return (
    <>
      <Modal title={t('Import a board from a picture')} onClose={onClose} wide dirty={step !== 'pick'} className="board-import" footer={footer}>
        {error && <p className="error">{error}</p>}
        {step === 'pick' && (
          <div className="bi-pick" data-scan-group>
            <p>{t('Take a photo or a screenshot of a board in another AAC app, or of a paper board. AACFree finds the grid, reads each word and puts every word in the same place, so the person can keep using the same moves.')}</p>
            <p className="muted small">{t('The picture stays on this device. The words are read on this device too, without the internet.')}</p>
            <div className="row">
              <button className="btn primary" data-scan-item disabled={busy} onClick={() => camRef.current?.click()}><IconCamera /> {t('Take photo')}</button>
              <button className="btn" data-scan-item disabled={busy} onClick={() => fileRef.current?.click()}>{t('Choose a picture')}</button>
            </div>
            {busy && <p className="muted">{t('Loading…')}</p>}
            <p className="muted small">{t('Tip: a screenshot works best. For a photo, hold the camera straight above the board, in good light.')}</p>
            <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ''; }} />
            <input ref={fileRef} className="bi-file" type="file" accept="image/*" hidden onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
        )}
        {step === 'grid' && pic && grid && <GridStep pic={pic} grid={grid} setGrid={setGrid} found={found} />}
        {step === 'reading' && (
          <div className="bi-reading">
            <p><b>{progress.loading ? t('Getting the word reader ready…') : t('Reading square {n} of {total}…', { n: Math.min(progress.total, progress.done + 1), total: progress.total })}</b></p>
            <progress className="bi-progress" max={progress.total || 1} value={progress.done} aria-label={t('Progress')} />
            <p className="muted small">{t('This happens on this device and can take a minute.')}</p>
          </div>
        )}
        {step === 'preview' && grid && (
          <div className="bi-preview">
            <p className="bi-summary">
              {t('Found {n} words in {rows} rows and {cols} columns. Tap a square to fix it.', { n: words, rows: grid.rows, cols: grid.cols })}
              {noWord > 0 && <> {t('{n} squares have a picture but no word yet. Tap them to type the word, or they stay empty.', { n: noWord })}</>}
            </p>
            <div className="field">
              <span>{t('Pictures')}</span>
              <div className="seg" data-scan-group>
                <button className={!allCrops ? 'on' : ''} data-scan-item onClick={() => setAllCrops(false)}>{t('AACFree symbols')}</button>
                <button className={allCrops ? 'on' : ''} data-scan-item onClick={() => setAllCrops(true)}>{t('Pictures from my screenshot')}</button>
              </div>
              <small>{t("Pictures from other apps may belong to the people who made them. Use them only for your family's own boards.")}</small>
            </div>
            <div className="bi-grid" data-scan-group data-scan-grid style={{ gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))` }}>
              {cells.map((c, i) => <PreviewCell key={i} cell={c} row={Math.floor(i / grid.cols)} onPress={() => setEditing(i)} />)}
            </div>
            <label className="field"><span>{t('Board name')}</span>
              <input className="bi-name" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="field">
              <span>{t('Where should it go?')}</span>
              <div className="seg" data-scan-group>
                <button className={mode === 'folder' ? 'on' : ''} data-scan-item onClick={() => setMode('folder')}>{t('A new folder on a board')}</button>
                <button className={mode === 'profile' ? 'on' : ''} data-scan-item onClick={() => setMode('profile')}>{t('A new profile')}</button>
              </div>
            </div>
            {mode === 'folder' ? (
              <label className="field"><span>{t('Put the folder on')}</span>
                <select value={parent} onChange={(e) => setParent(e.target.value)}>
                  {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <small>{t('The folder goes in the first empty square. If the board is full, a new row is added at the bottom. Nothing else moves.')}</small>
              </label>
            ) : (
              <p className="muted small">{t('A new profile starts with this board as its Home board. This profile is not changed.')}</p>
            )}
            <p className="muted small">{t('A snapshot is saved first, so you can go back.')}</p>
          </div>
        )}
      </Modal>
      {editing !== null && cells[editing] && (
        <CellEditor cell={cells[editing]} onClose={() => setEditing(null)}
          onChange={(patch) => setCell(editing, patch)} />
      )}
    </>
  );
}

function GridStep({ pic, grid, setGrid, found }: { pic: Picture; grid: GridBox; setGrid: (g: GridBox) => void; found: boolean }) {
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<null | 'top' | 'bottom' | 'left' | 'right'>(null);
  const MIN = 0.05;
  const moveEdge = (edge: 'top' | 'bottom' | 'left' | 'right', v: number) => {
    const g = { ...grid };
    const right = g.x + g.w, bottom = g.y + g.h;
    v = clamp(v, 0, 1);
    if (edge === 'left') { g.x = Math.min(v, right - MIN); g.w = right - g.x; }
    if (edge === 'right') g.w = Math.max(MIN, v - g.x);
    if (edge === 'top') { g.y = Math.min(v, bottom - MIN); g.h = bottom - g.y; }
    if (edge === 'bottom') g.h = Math.max(MIN, v - g.y);
    setGrid(g);
  };
  const edgeValue = (edge: 'top' | 'bottom' | 'left' | 'right') =>
    edge === 'left' ? grid.x : edge === 'right' ? grid.x + grid.w : edge === 'top' ? grid.y : grid.y + grid.h;
  const down = (edge: 'top' | 'bottom' | 'left' | 'right') => (e: ReactPointerEvent<HTMLElement>) => {
    e.preventDefault();
    drag.current = edge;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent<HTMLElement>) => {
    const edge = drag.current;
    const r = stage.current?.getBoundingClientRect();
    if (!edge || !r) return;
    moveEdge(edge, edge === 'left' || edge === 'right' ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height);
  };
  const up = () => { drag.current = null; };
  // Drag handles for touch and mouse; the arrow buttons below do the same for keyboard and switch users.
  const handle = (edge: 'top' | 'bottom' | 'left' | 'right') => (
    <span className={`bi-handle bi-${edge}`} aria-hidden
      onPointerDown={down(edge)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
  );
  const lines = [
    ...Array.from({ length: grid.cols - 1 }, (_, i) => <line key={`c${i}`} x1={((i + 1) * 100) / grid.cols} x2={((i + 1) * 100) / grid.cols} y1={0} y2={100} />),
    ...Array.from({ length: grid.rows - 1 }, (_, i) => <line key={`r${i}`} y1={((i + 1) * 100) / grid.rows} y2={((i + 1) * 100) / grid.rows} x1={0} x2={100} />),
  ];
  const stepper = (label: string, cls: string, v: number, set: (n: number) => void, min: number, max: number) => (
    <div className={`field bi-stepper ${cls}`} data-scan-group>
      <span>{label}</span>
      <div className="stepper">
        <button className="btn bi-minus" data-scan-item aria-label={t('Fewer')} disabled={v <= min} onClick={() => set(v - 1)}>−</button>
        <b className="bi-count">{v}</b>
        <button className="btn bi-plus" data-scan-item aria-label={t('More')} disabled={v >= max} onClick={() => set(v + 1)}>+</button>
      </div>
    </div>
  );
  const nudge = (edge: 'top' | 'bottom' | 'left' | 'right', label: string) => (
    <div className="bi-nudge" data-scan-group>
      <span>{label}</span>
      <button className="btn small" data-scan-item aria-label={t('{edge}: move up or left', { edge: label })} onClick={() => moveEdge(edge, edgeValue(edge) - 0.005)}>{edge === 'left' || edge === 'right' ? '←' : '↑'}</button>
      <button className="btn small" data-scan-item aria-label={t('{edge}: move down or right', { edge: label })} onClick={() => moveEdge(edge, edgeValue(edge) + 0.005)}>{edge === 'left' || edge === 'right' ? '→' : '↓'}</button>
    </div>
  );
  return (
    <div className="bi-gridstep">
      <p className="bi-found">{found
        ? t('Found {rows} rows and {cols} columns. Check that the lines sit between the buttons, then read the words.', { rows: grid.rows, cols: grid.cols })
        : t('AACFree could not find the buttons by itself. Drag the edges onto the board and set the rows and columns.')}</p>
      <div className="bi-stage" ref={stage} style={{ aspectRatio: `${pic.aspect}`, width: `min(100%, ${(52 * pic.aspect).toFixed(1)}vh)` }}>
        <img src={pic.url} alt={t('Your picture')} draggable={false} />
        <div className="bi-area" style={{ left: `${grid.x * 100}%`, top: `${grid.y * 100}%`, width: `${grid.w * 100}%`, height: `${grid.h * 100}%` }}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>{lines}</svg>
          {handle('top')}
          {handle('bottom')}
          {handle('left')}
          {handle('right')}
        </div>
      </div>
      <div className="row bi-steppers">
        {stepper(t('Rows'), 'bi-rows', grid.rows, (rows) => setGrid({ ...grid, rows }), 1, MAX_ROWS)}
        {stepper(t('Columns'), 'bi-cols', grid.cols, (cols) => setGrid({ ...grid, cols }), 1, MAX_COLS)}
      </div>
      <details className="bi-edges">
        <summary>{t('Move the edges a little')}</summary>
        <div className="bi-nudges">
          {nudge('top', t('Top edge'))}
          {nudge('bottom', t('Bottom edge'))}
          {nudge('left', t('Left edge'))}
          {nudge('right', t('Right edge'))}
        </div>
      </details>
    </div>
  );
}

function PreviewCell({ cell, row, onPress }: { cell: ImportCell; row: number; onPress: () => void }) {
  if (cell.empty) {
    return <button className="cell cell-add bi-cell bi-empty" data-scan-item data-row={row} onClick={onPress} aria-label={t('Empty square')} />;
  }
  const type = cell.folder ? 'folder' : cell.type;
  let pic = null;
  if (cell.useCrop && cell.crop) pic = <img className="sym" src={cell.crop.url} alt="" draggable={false} />;
  else if (cell.symbol) pic = <Symbol value={cell.symbol} />;
  return (
    <button className={`cell bi-cell ${cell.folder ? 'cell-folder' : ''} ${cell.word ? '' : 'bi-noword'}`} data-scan-item data-row={row}
      style={{ background: WORD_COLORS[type].light }} onClick={onPress} aria-label={cell.word || t('No word yet')}>
      {pic}
      <span className="cell-label">{cell.word || '?'}</span>
    </button>
  );
}

function CellEditor({ cell, onChange, onClose }: { cell: ImportCell; onChange: (p: Partial<ImportCell>) => void; onClose: () => void }) {
  const library = useStore((s) => s.data.library);
  const [picking, setPicking] = useState(false);
  const setWord = (word: string) => {
    const patch: Partial<ImportCell> = { word };
    if (!cell.symbolChosen) {
      const hit = suggestSymbol(library, word);
      patch.symbol = hit?.symbol;
    }
    if (word.trim()) patch.empty = false;
    onChange(patch);
  };
  return (
    <>
      <Modal title={t('Fix this square')} onClose={onClose}
        footer={<><span className="spacer" /><button className="btn primary" data-scan-item onClick={onClose}>{t('Done')}</button></>}>
        <label className="field"><span>{t('Word')}</span>
          <input className="bi-word" autoFocus value={cell.word} onChange={(e) => setWord(e.target.value)} placeholder={t('Type the word on this button')} />
        </label>
        <div className="field">
          <span>{t('Picture')}</span>
          <div className="bi-pics" data-scan-group>
            <button className={`sym-opt ${!cell.useCrop ? 'on' : ''}`} data-scan-item onClick={() => onChange({ useCrop: false })}>
              {cell.symbol ? <Symbol value={cell.symbol} /> : <span className="sym" />}
              <span>{t('AACFree symbol')}</span>
            </button>
            {cell.crop && (
              <button className={`sym-opt ${cell.useCrop ? 'on' : ''}`} data-scan-item onClick={() => onChange({ useCrop: true })}>
                <img className="sym" src={cell.crop.url} alt="" />
                <span>{t('From my screenshot')}</span>
              </button>
            )}
            <button className="btn" data-scan-item onClick={() => setPicking(true)}>{t('Choose another picture…')}</button>
          </div>
        </div>
        <div className="field">
          <span>{t('Word type (colour)')}</span>
          <div className="types" data-scan-group>
            {(Object.keys(WORD_COLORS) as WordType[]).filter((w) => w !== 'folder').map((w) => (
              <button key={w} className={`type-chip ${cell.type === w ? 'on' : ''}`} data-scan-item style={{ background: WORD_COLORS[w].light }} onClick={() => onChange({ type: w })}>
                {t(WORD_COLORS[w].name)}
              </button>
            ))}
          </div>
        </div>
        <div data-scan-group>
          <label className="check">
            <input type="checkbox" data-scan-item checked={cell.empty} onChange={(e) => onChange({ empty: e.target.checked })} />
            <span>{t('Empty square')} <small>{t('(nothing on this square)')}</small></span>
          </label>
          <label className="check">
            <input type="checkbox" data-scan-item checked={cell.folder} onChange={(e) => onChange({ folder: e.target.checked })} />
            <span>{t('Opens a folder')} <small>{t('(makes an empty folder with this name, to fill in later)')}</small></span>
          </label>
        </div>
      </Modal>
      {picking && (
        <SymbolPicker initialQuery={cell.word} noLibrarySave onClose={() => setPicking(false)}
          onPick={(symbol, label) => {
            onChange({ symbol, symbolChosen: true, useCrop: false, ...(cell.word.trim() || !label ? {} : { word: label, empty: false }) });
            setPicking(false);
          }} />
      )}
    </>
  );
}
