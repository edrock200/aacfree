import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import type { AACButton, Board, Cell, Profile, WordType } from '../types';
import { buttonColor } from './colors';
import { getAsset, putAsset } from './db';
import { uid } from './util';

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
}
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

/** Import an .obz package (or a single .obf board) into a new profile's boards. */
export async function importOBF(file: File): Promise<{ boards: Record<string, Board>; rootId: string; name: string }> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let entries: Record<string, Uint8Array>;
  let rootPath: string;
  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    entries = unzipSync(buf);
    const manifest = JSON.parse(strFromU8(entries['manifest.json']));
    rootPath = manifest.root;
  } else {
    rootPath = 'board.obf';
    entries = { 'board.obf': buf };
  }

  const pathToId: Record<string, string> = {};
  const boards: Record<string, Board> = {};
  const obfs: Record<string, OBFBoard> = {};
  for (const [path, bytes] of Object.entries(entries)) {
    if (!path.endsWith('.obf')) continue;
    const obf = JSON.parse(strFromU8(bytes)) as OBFBoard;
    obfs[path] = obf;
    pathToId[path] = uid('obf-');
  }
  if (!obfs[rootPath]) throw new Error('No root board found in this file.');

  for (const [path, obf] of Object.entries(obfs)) {
    const rows = Math.max(1, obf.grid?.rows ?? 1);
    const cols = Math.max(1, obf.grid?.columns ?? 1);
    const byId = new Map(obf.buttons.map((b) => [String(b.id), b]));
    const imgs = new Map((obf.images ?? []).map((i) => [String(i.id), i]));
    const cells: Cell[] = Array(rows * cols).fill(null);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const bid = obf.grid.order?.[r]?.[c];
        if (bid == null) continue;
        const ob = byId.get(String(bid));
        if (!ob) continue;
        const b: AACButton = {
          id: uid('b'),
          label: ob.label ?? ob.vocalization ?? '',
          type: (ob.ext_caleb_type as WordType) ?? 'misc',
        };
        if (ob.vocalization && ob.vocalization !== ob.label) b.speak = ob.vocalization;
        if (ob.hidden) b.hidden = true;
        if (!ob.ext_caleb_type) b.color = rgbToHex(ob.background_color);
        if (ob.load_board) {
          const target = ob.load_board.path && pathToId[ob.load_board.path]
            ? pathToId[ob.load_board.path]
            : Object.entries(obfs).find(([, o]) => o.id === ob.load_board!.id)?.[0];
          const tid = target && (pathToId[target] ?? target);
          if (tid) { b.link = tid; b.type = 'folder'; delete b.color; }
        }
        if (ob.image_id && imgs.has(String(ob.image_id))) {
          const img = imgs.get(String(ob.image_id))!;
          const sym = await importImage(img, entries);
          if (sym) b.symbol = sym;
        }
        cells[r * cols + c] = b;
      }
    }
    const id = pathToId[path];
    boards[id] = { id, name: obf.name ?? 'Board', cols, rows, cells };
  }
  // Fix links that pointed at obf paths.
  for (const b of Object.values(boards)) for (const c of b.cells) if (c?.link && pathToId[c.link]) c.link = pathToId[c.link];
  const rootId = pathToId[rootPath];
  return { boards, rootId, name: obfs[rootPath].name ?? 'Imported board' };
}

async function importImage(img: OBFImage, entries: Record<string, Uint8Array>): Promise<string | undefined> {
  try {
    let blob: Blob | undefined;
    if (img.path && entries[img.path]) blob = new Blob([entries[img.path].slice().buffer as ArrayBuffer], { type: img.content_type ?? 'image/png' });
    else if (img.data) blob = await (await fetch(img.data)).blob();
    else if (img.url) {
      const m = /arasaac\.org\/pictograms\/(\d+)\//.exec(img.url);
      if (m) return `a:${m[1]}`; // fall back to remote ARASAAC if not bundled
      blob = await (await fetch(img.url)).blob();
    }
    if (!blob) return undefined;
    const id = uid('obf-img-');
    await putAsset(id, blob);
    return `img:${id}`;
  } catch {
    return undefined;
  }
}
