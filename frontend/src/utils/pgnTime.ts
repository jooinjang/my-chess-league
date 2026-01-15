export type PgnTimeDisplayMode = 'clock' | 'elapsed' | 'none';

export interface PgnTimeData {
  timeControlRaw?: string;
  timeControlLabel?: string;
  displayMode: PgnTimeDisplayMode;
  // Arrays are aligned to ply index (0-based): moves[0] = White's 1st move
  clockAfterSeconds?: Array<number | null>;
  elapsedSeconds?: Array<number | null>;
}

function parseTagPairs(pgn: string): Record<string, string> {
  const tags: Record<string, string> = {};
  const tagRe = /^\[(\w+)\s+"([^"]*)"\]\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(pgn)) !== null) {
    tags[m[1]] = m[2];
  }
  return tags;
}

function stripHeader(pgn: string): string {
  return pgn
    .split('\n')
    .filter((line) => !line.trim().startsWith('['))
    .join('\n');
}

function parseClockToSeconds(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;

  // Supports:
  // - H:MM:SS(.ms)
  // - M:SS(.ms)
  // - SS(.ms)
  const parts = t.split(':').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0 || parts.length > 3) return null;

  const last = parts[parts.length - 1];
  const sec = Number(last);
  if (!Number.isFinite(sec)) return null;

  let seconds = sec;
  if (parts.length >= 2) {
    const mm = Number(parts[parts.length - 2]);
    if (!Number.isFinite(mm)) return null;
    seconds += mm * 60;
  }
  if (parts.length === 3) {
    const hh = Number(parts[0]);
    if (!Number.isFinite(hh)) return null;
    seconds += hh * 3600;
  }
  return seconds;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;

  const pad2 = (n: number) => String(n).padStart(2, '0');
  if (hh > 0) return `${hh}:${pad2(mm)}:${pad2(ss)}`;
  return `${mm}:${pad2(ss)}`;
}

export function formatElapsed(seconds: number): string {
  const s = Math.max(0, seconds);
  if (s < 60) return `${s.toFixed(1)}s`;
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${mm}m ${String(ss).padStart(2, '0')}s`;
}

export function formatTimeControl(raw: string): string {
  const tc = raw.trim();
  if (!tc) return '';

  // Common chess.com style: "600+5" (base seconds + increment seconds)
  const incMatch = /^(\d+)\+(\d+)$/.exec(tc);
  if (incMatch) {
    const base = Number(incMatch[1]);
    const inc = Number(incMatch[2]);
    if (Number.isFinite(base) && Number.isFinite(inc)) {
      const baseMin = base % 60 === 0 ? `${base / 60}분` : `${base}s`;
      const incStr = `${inc}초`;
      return `${baseMin} + ${incStr}`;
    }
  }

  // If just seconds like "300"
  const secMatch = /^(\d+)$/.exec(tc);
  if (secMatch) {
    const base = Number(secMatch[1]);
    if (Number.isFinite(base)) {
      return base % 60 === 0 ? `${base / 60}분` : `${base}s`;
    }
  }

  return tc;
}

export function parsePgnTimeData(pgn: string): PgnTimeData {
  const tags = parseTagPairs(pgn);
  const timeControlRaw = tags.TimeControl;
  const timeControlLabel = timeControlRaw ? formatTimeControl(timeControlRaw) : undefined;

  const moveText = stripHeader(pgn);

  // Note: We intentionally keep this simple: in most sources (chess.com),
  // [%clk]/[%emt] appear in-order aligned with plies.
  const clkRe = /\[%clk\s+([0-9]+(?::[0-9]{1,2}){0,2}(?:\.[0-9]+)?)\]/g;
  const emtRe = /\[%emt\s+([0-9]+(?::[0-9]{1,2}){0,2}(?:\.[0-9]+)?)\]/g;

  const clockAfterSeconds: Array<number | null> = [];
  const elapsedSeconds: Array<number | null> = [];

  let m: RegExpExecArray | null;
  while ((m = clkRe.exec(moveText)) !== null) {
    clockAfterSeconds.push(parseClockToSeconds(m[1]));
  }
  while ((m = emtRe.exec(moveText)) !== null) {
    elapsedSeconds.push(parseClockToSeconds(m[1]));
  }

  const hasClk = clockAfterSeconds.length > 0;
  const hasEmt = elapsedSeconds.length > 0;
  const displayMode: PgnTimeDisplayMode = hasClk ? 'clock' : hasEmt ? 'elapsed' : 'none';

  return {
    timeControlRaw,
    timeControlLabel,
    displayMode,
    clockAfterSeconds: hasClk ? clockAfterSeconds : undefined,
    elapsedSeconds: hasEmt ? elapsedSeconds : undefined,
  };
}
