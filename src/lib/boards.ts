import type { AACButton, Board, Cell, Profile } from '../types';

/** Resize a board keeping every button at the same row/column. */
export function resizeBoard(board: Board, cols: number, rows: number): { board: Board; lost: number } {
  const cells: Cell[] = Array(cols * rows).fill(null);
  let lost = 0;
  board.cells.forEach((b, i) => {
    const r = Math.floor(i / board.cols);
    const c = i % board.cols;
    if (r < rows && c < cols) cells[r * cols + c] = b;
    else if (b) lost++;
  });
  return { board: { ...board, cols, rows, cells }, lost };
}

/** Breadth-first path of board ids from the root to every reachable board. */
export function boardPaths(p: Profile): Record<string, string[]> {
  const paths: Record<string, string[]> = { [p.rootId]: [p.rootId] };
  const queue = [p.rootId];
  while (queue.length) {
    const id = queue.shift()!;
    const b = p.boards[id];
    if (!b) continue;
    for (const c of b.cells) {
      if (c?.link && !paths[c.link] && p.boards[c.link]) {
        paths[c.link] = [...paths[id], c.link];
        queue.push(c.link);
      }
    }
  }
  return paths;
}

export interface FindResult {
  button: AACButton;
  boardId: string;
  path: string[]; // board ids from root
  folderButtonIds: string[]; // folder buttons to tap along the way
}

/** Finds where a word lives (for "Find word" and modelling). */
export function findWord(p: Profile, query: string, limit = 30): FindResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const paths = boardPaths(p);
  const out: (FindResult & { score: number })[] = [];
  for (const [boardId, board] of Object.entries(p.boards)) {
    const path = paths[boardId];
    if (!path) continue;
    for (const b of board.cells) {
      if (!b || b.link || b.action) continue;
      const label = b.label.toLowerCase();
      const score = label === q ? 0 : label.startsWith(q) ? 1 : label.includes(q) ? 2 : -1;
      if (score < 0) continue;
      const folderButtonIds: string[] = [];
      for (let i = 0; i < path.length - 1; i++) {
        const fb = p.boards[path[i]].cells.find((c) => c?.link === path[i + 1]);
        if (fb) folderButtonIds.push(fb.id);
      }
      out.push({ button: b, boardId, path, folderButtonIds, score: score * 10 + path.length });
    }
  }
  return out.sort((a, b) => a.score - b.score).slice(0, limit);
}

/** Every unique word label across all boards (for keyboard prediction). */
export function vocabularyWords(p: Profile): string[] {
  const set = new Set<string>();
  for (const b of Object.values(p.boards)) {
    for (const c of b.cells) if (c && !c.link && !c.action) set.add((c.speak ?? c.label).toLowerCase());
  }
  return [...set];
}

/** Boards that are not reachable from the root (orphans). */
export function orphanBoards(p: Profile): string[] {
  const paths = boardPaths(p);
  return Object.keys(p.boards).filter((id) => !paths[id]);
}
