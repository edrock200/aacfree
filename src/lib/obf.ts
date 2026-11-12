import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { AACButton, Board, ButtonAction, Cell, Profile, WordType } from '../types';
import { buttonColor } from './colors';
import { getAsset, putAsset } from './db';
import { uid } from './util';
import { cleanBoard, MAX_COLS, MAX_ROWS, safeColor } from './validate';
import symbolMap from '../data/symbols.json';

const BUNDLED = new Set(Object.values(symbolMap as Record<string, number | null>).filter((x): x is number => !!x));
const MAX_FILE = 150 * 1024 * 1024;

/**
 * Open Board Format (https://www.openboardformat.org) import / export, so
 * boards can move between Caleb, CoughDrop, Cboard and other AAC apps.
 */

interface OBFButton {
  id: string;
  label?: string;
  vocalization?: string;
  image_id?: string;
  background_color?: string;
  border_color?: string;
  load_board?: { id?: string; path?: string; url?: string };
  action?: string;
  hidden?: boolean;
  ext_caleb_type?: string;
  ext_caleb_action?: string;
  ext_caleb_color?: string;
  ext_caleb_speak_only?: boolean;
}

// Caleb actions ↔ OBF spec actions (others round-trip via ext_caleb_action).
const TO_OBF_ACTION: Partial<Record<string, string>> = { home: ':home', speak: ':speak', clear: ':clear', backspace: ':backspace', back: ':back' };
const FROM_OBF_ACTION: Record<string, ButtonAction> = { ':home': 'home', ':speak': 'speak', ':clear': 'clear', ':backspace': 'backspace', ':back': 'back' };
interface OBFImage { id: string; url?: string; data?: string; path?: string; content_type?: string; width?: number; height?: number }
interface OBFBoard {
  format: string;
  id: string;
  locale?: string;
  name?: string;
  grid: { rows: number; columns: number; order: (string | number | null)[][] };
  buttons: OBFButton[];
  images?: OBFImage[];
}

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
const rgbToHex = (rgb?: string) => {
  const m = rgb && /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
  if (!m) return undefined;
  return '#' + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, '0')).join('');
};

async function symbolBytes(ref: string): Promise<{ bytes: Uint8Array; type: string; ext: string } | null> {
  try {
    let blob: Blob | undefined;
    if (ref.startsWith('a:')) {
      blob = await (await fetch(`${import.meta.env.BASE_URL}symbols/${ref.slice(2)}.webp`)).blob();
    } else if (ref.startsWith('img:')) {
      blob = await getAsset(ref.slice(4));
    }
    if (!blob) return null;
    const type = blob.type || 'image/webp';
    const ext = type.includes('png') ? 'png' : type.includes('jpeg') ? 'jpg' : 'webp';
    return { bytes: new Uint8Array(await blob.arrayBuffer()), type, ext };
  } catch {
    return null;
  }
}

/** Export every board of a profile as an .obz (zip) package. */
export async function exportOBZ(p: Profile): Promise<Blob> {
  const files: Record<string, Uint8Array> = {};
  const boardPaths: Record<string, string> = {};
  const imagePaths: Record<string, string> = {};
  for (const id of Object.keys(p.boards)) boardPaths[id] = `boards/${id}.obf`;

  for (const board of Object.values(p.boards)) {
    const buttons: OBFButton[] = [];
    const images: OBFImage[] = [];
    const order: (string | null)[][] = [];
    for (let r = 0; r < board.rows; r++) {
      const row: (string | null)[] = [];
      for (let c = 0; c < board.cols; c++) {
        const b = board.cells[r * board.cols + c];
        if (!b) { row.push(null); continue; }
        row.push(b.id);
        const ob: OBFButton = {
          id: b.id,
          label: b.label,
          background_color: hexToRgb(buttonColor(b.type, false, b.color)),
          ext_caleb_type: b.type,
        };
        if (b.speak) ob.vocalization = b.speak;
        if (b.hidden) ob.hidden = true;
        if (b.color) ob.ext_caleb_color = b.color;
        if (b.speakOnly) ob.ext_caleb_speak_only = true;
        if (b.action) {
          ob.ext_caleb_action = b.action;
          if (TO_OBF_ACTION[b.action]) ob.action = TO_OBF_ACTION[b.action];
        }
        if (b.link && boardPaths[b.link]) ob.load_board = { id: b.link, path: boardPaths[b.link] };
        if (b.symbol && !b.symbol.startsWith('e:')) {
          const imgId = b.symbol.replace(/[^a-z0-9]/gi, '_');
          if (!imagePaths[imgId]) {
            const bytes = await symbolBytes(b.symbol);
            if (bytes) {
              imagePaths[imgId] = `images/${imgId}.${bytes.ext}`;
              files[imagePaths[imgId]] = bytes.bytes;
            }
          }
          if (imagePaths[imgId]) {
            ob.image_id = imgId;
            if (!images.some((i) => i.id === imgId)) {
              images.push({
                id: imgId, path: imagePaths[imgId], content_type: `image/${imagePaths[imgId].split('.').pop()}`, width: 200, height: 200,
                ...(b.symbol.startsWith('a:') ? { url: `https://static.arasaac.org/pictograms/${b.symbol.slice(2)}/${b.symbol.slice(2)}_300.png` } : {}),
              });
            }
          }
        } else if (b.symbol?.startsWith('e:')) {
          ob.label = b.label;
        }
        buttons.push(ob);
      }
      order.push(row);
    }
    const obf: OBFBoard = {
      format: 'open-board-0.1', id: board.id, locale: 'en', name: board.name,
      grid: { rows: board.rows, columns: board.cols, order }, buttons, images,
    };
    files[boardPaths[board.id]] = strToU8(JSON.stringify(obf, null, 1));
  }
  files['manifest.json'] = strToU8(JSON.stringify({
    format: 'open-board-0.1', root: boardPaths[p.rootId], paths: { boards: boardPaths, images: imagePaths },
  }, null, 1));
  const zipped = zipSync(files, { level: 6 });
  return new Blob([zipped.buffer as ArrayBuffer], { type: 'application/zip' });
}

/** Import limits: a crafted archive must not freeze or kill the app. */
export const OBZ_LIMITS = {
  /** Inflated size of one board (.obf) or the manifest. */
  boardBytes: 5 * 1024 * 1024,
  /** Inflated size of one image. */
  imageBytes: 8 * 1024 * 1024,
  /** Inflated size of everything taken from the archive. */
  totalBytes: 200 * 1024 * 1024,
  /** Entries looked at in the archive. */
  entries: 20000,
  boards: 500,
  images: 5000,
};

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp)$/i;

/** Unzips only boards, images and the manifest, within the size caps (sizes come from the zip directory, and inflation never writes past them). */
function readArchive(buf: Uint8Array): Record<string, Uint8Array> {
  let total = 0;
  let count = 0;
  let boards = 0;
  let images = 0;
  let tooBig = false;
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(buf, {
      filter: (f) => {
        if (++count > OBZ_LIMITS.entries) { tooBig = true; return false; }
        const name = f.name;
        const isBoard = name.endsWith('.obf') || name === 'manifest.json';
        const isImage = IMAGE_EXT.test(name);
        if (!isBoard && !isImage) return false;
        if (isBoard && (f.originalSize > OBZ_LIMITS.boardBytes || (name !== 'manifest.json' && ++boards > OBZ_LIMITS.boards))) { tooBig = true; return false; }
        if (isImage && (f.originalSize > OBZ_LIMITS.imageBytes || ++images > OBZ_LIMITS.images)) return false; // skip just that picture
        total += f.originalSize;
        if (total > OBZ_LIMITS.totalBytes) { tooBig = true; return false; }
        return true;
      },
    });
  } catch {
    throw new Error('This file is damaged or is not a board file.');
  }
  if (tooBig) throw new Error('This file is too large to import.');
  return entries;
}

function parseJSON(bytes: Uint8Array | undefined): unknown {
  if (!bytes) return undefined;
  try { return JSON.parse(strFromU8(bytes)); } catch { return undefined; }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Import an .obz package (or a single .obf board) into a new profile's boards. */
export async function importOBF(file: File): Promise<{ boards: Record<string, Board>; rootId: string; name: string }> {
  if (file.size > MAX_FILE) throw new Error('This file is too large to import.');
  const buf = new Uint8Array(await file.arrayBuffer());
  let entries: Record<string, Uint8Array>;
  let rootPath: string | undefined;
  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    entries = readArchive(buf);
    const manifest = parseJSON(entries['manifest.json']);
    if (isObj(manifest) && typeof manifest.root === 'string' && entries[manifest.root]) rootPath = manifest.root;
    else {
      // No usable manifest: fine when there is just one board.
      const obfPaths = Object.keys(entries).filter((p) => p.endsWith('.obf'));
      if (obfPaths.length === 1) rootPath = obfPaths[0];
      else if (!entries['manifest.json']) throw new Error('This .obz file has no manifest, so Caleb can’t tell which board comes first.');
      else throw new Error('No root board found in this file.');
    }
  } else {
    if (file.size > OBZ_LIMITS.boardBytes) throw new Error('This file is too large to import.');
    rootPath = 'board.obf';
    entries = { 'board.obf': buf };
  }

  const pathToId: Record<string, string> = {};
  const boards: Record<string, Board> = {};
  const obfs: Record<string, OBFBoard> = {};
  for (const [path, bytes] of Object.entries(entries)) {
    if (!path.endsWith('.obf')) continue;
    const obf = parseJSON(bytes) as OBFBoard | undefined;
    if (!isObj(obf)) continue;
    obf.buttons = Array.isArray(obf.buttons) ? obf.buttons.filter(isObj) as unknown as OBFButton[] : [];
    if (!isObj(obf.grid) || !Array.isArray(obf.grid.order)) obf.grid = { rows: 1, columns: 1, order: [] };
    obf.images = Array.isArray(obf.images) ? obf.images.filter(isObj) as unknown as OBFImage[] : [];
    obfs[path] = obf;
    pathToId[path] = uid('obf-');
  }
  if (!rootPath || !obfs[rootPath]) throw new Error('No root board found in this file.');

  const text = (v: unknown, max = 500) => (typeof v === 'string' ? v.slice(0, max) : typeof v === 'number' ? String(v) : undefined);
  // One stored copy per image (keyed by file path when shared across boards).
  const imageCache = new Map<string, Promise<string | undefined>>();
  for (const [path, obf] of Object.entries(obfs)) {
    const rows = Math.min(MAX_ROWS, Math.max(1, Math.round(Number(obf.grid?.rows)) || 1));
    const cols = Math.min(MAX_COLS, Math.max(1, Math.round(Number(obf.grid?.columns)) || 1));
    const byId = new Map(obf.buttons.map((b) => [String(b.id), b]));
    const imgs = new Map((obf.images ?? []).map((i) => [String(i.id), i]));
    const cells: Cell[] = Array(rows * cols).fill(null);
    for (let r = 0; r < rows; r++) {
      const row = obf.grid.order[r];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < cols; c++) {
        const bid = row[c];
        if (bid == null || typeof bid === 'object') continue;
        const ob = byId.get(String(bid));
        if (!ob) continue;
        const label = text(ob.label, 200);
        const vocal = text(ob.vocalization, 1000);
        const b: AACButton = {
          id: uid('b'),
          label: label ?? vocal ?? '',
          type: (typeof ob.ext_caleb_type === 'string' ? ob.ext_caleb_type : 'misc') as WordType,
        };
        if (vocal && vocal !== label) b.speak = vocal;
        if (ob.hidden === true) b.hidden = true;
        if (ob.ext_caleb_color) b.color = safeColor(ob.ext_caleb_color);
        else if (!ob.ext_caleb_type) b.color = safeColor(rgbToHex(typeof ob.background_color === 'string' ? ob.background_color : undefined));
        if (!b.color) delete b.color;
        if (ob.ext_caleb_speak_only === true) b.speakOnly = true;
        const action = (typeof ob.ext_caleb_action === 'string' ? ob.ext_caleb_action as ButtonAction : undefined)
          ?? (typeof ob.action === 'string' ? FROM_OBF_ACTION[ob.action] : undefined);
        if (action) b.action = action;
        const lb = isObj(ob.load_board) ? ob.load_board : undefined;
        if (lb) {
          const target = typeof lb.path === 'string' && pathToId[lb.path]
            ? lb.path
            : Object.entries(obfs).find(([, o]) => lb.id != null && String(o.id) === String(lb.id))?.[0];
          const tid = target && pathToId[target];
          if (tid) { b.link = tid; b.type = 'folder'; delete b.color; }
        }
        if (ob.image_id != null && imgs.has(String(ob.image_id))) {
          const im = imgs.get(String(ob.image_id))!;
          const key = (typeof im.url === 'string' && im.url) || (typeof im.path === 'string' && im.path) || `${path}#${ob.image_id}`;
          if (!imageCache.has(key)) imageCache.set(key, importImage(im, entries));
          const sym = await imageCache.get(key)!;
          if (sym) b.symbol = sym;
        }
        cells[r * cols + c] = b;
      }
    }
    const id = pathToId[path];
    boards[id] = cleanBoard({ id, name: text(obf.name, 100) ?? 'Board', cols, rows, cells }, id)!;
  }
  const rootId = pathToId[rootPath];
  return { boards, rootId, name: text(obfs[rootPath].name, 100) || 'Imported board' };
}

async function importImage(img: OBFImage, entries: Record<string, Uint8Array>): Promise<string | undefined> {
  try {
    const url = typeof img.url === 'string' ? img.url : undefined;
    // ARASAAC pictograms we already bundle need no stored copy.
    const arasaac = url ? /^https:\/\/(static|api)\.arasaac\.org\/.*?(\d+)/.exec(url) : null;
    if (arasaac && BUNDLED.has(Number(arasaac[2]))) return `a:${arasaac[2]}`;
    let blob: Blob | undefined;
    const type = typeof img.content_type === 'string' && /^image\/[\w.+-]+$/.test(img.content_type) ? img.content_type : 'image/png';
    const path = typeof img.path === 'string' ? img.path : undefined;
    if (path && entries[path]) blob = new Blob([entries[path].slice().buffer as ArrayBuffer], { type });
    else if (typeof img.data === 'string' && img.data.length < OBZ_LIMITS.imageBytes * 1.4 && /^data:image\//.test(img.data)) blob = await (await fetch(img.data)).blob();
    else if (arasaac) return `a:${arasaac[2]}`; // shown from arasaac.org when online
    // Never fetch other remote URLs named in an imported file (privacy).
    if (!blob || blob.size > OBZ_LIMITS.imageBytes) return undefined;
    const id = uid('obf-img-');
    await putAsset(id, blob);
    return `img:${id}`;
  } catch {
    return undefined;
  }
}
