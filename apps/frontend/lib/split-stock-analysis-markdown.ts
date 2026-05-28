/**
 * Split model-written chart analysis into a short "collapsed" prefix and full body.
 *
 * Primary: detect **Overview:** / ## Overview and later **Momentum:** / ## Momentum, etc.
 * Fallback: long text without those headings still collapses at a paragraph boundary.
 */

function isOverviewHeaderLine(raw: string): boolean {
  const s = raw.trim();
  // Bold "Overview:" or "Overview" — colon inside emphasis: **Overview:**
  if (/^\*\*Overview:?\*\*\s*$/i.test(s)) {
    return true;
  }
  // Legacy: **Overview** or **Overview**: (colon after closing bold)
  if (/^\*\*Overview\*\*:?\s*$/i.test(s)) {
    return true;
  }
  if (/^#{1,3}\s+\*\*Overview:?\*\*\s*$/i.test(s)) {
    return true;
  }
  if (/^#{1,3}\s+\*\*Overview\*\*:?\s*$/i.test(s)) {
    return true;
  }
  if (/^#{1,3}\s+Overview\b[:\s]?\s*$/i.test(s)) {
    return true;
  }
  if (/^Overview:\s*$/i.test(s)) {
    return true;
  }
  return false;
}

const SECTION_CORE = '(?:Momentum|Indicators|Levels(?:\\s*\\/\\s*Risks)?)';

function isFollowingSectionLine(raw: string): boolean {
  const s = raw.trim();
  if (new RegExp(`^#{1,3}\\s+${SECTION_CORE}\\b`, 'i').test(s)) {
    return true;
  }
  if (new RegExp(`^#{1,3}\\s+\\*\\*${SECTION_CORE}:?\\*\\*\\s*$`, 'i').test(s)) {
    return true;
  }
  // **Momentum:**, **Levels / Risks:** (colon inside bold)
  if (new RegExp(`^\\*\\*${SECTION_CORE}:?\\*\\*\\s*$`, 'i').test(s)) {
    return true;
  }
  if (new RegExp(`^\\*\\*${SECTION_CORE}\\*\\*:?\\s*$`, 'i').test(s)) {
    return true;
  }
  return false;
}

const MIN_CHARS_FOR_FALLBACK = 380;
const FALLBACK_PREVIEW_TARGET = 360;

function truncateForFallback(text: string, targetLen: number): string {
  if (text.length <= targetLen) {
    return text;
  }
  const scanEnd = Math.min(text.length, targetLen + 200);
  const window = text.slice(0, scanEnd);
  const doubleBreaks: number[] = [];
  let idx = 0;
  while (idx < window.length) {
    const found = window.indexOf('\n\n', idx);
    if (found === -1) {
      break;
    }
    if (found <= targetLen && found >= 80) {
      doubleBreaks.push(found);
    }
    idx = found + 2;
  }
  if (doubleBreaks.length > 0) {
    const lastDoubleBreak = doubleBreaks[doubleBreaks.length - 1];
    return window.slice(0, lastDoubleBreak).trimEnd();
  }
  const lastSpace = window.lastIndexOf(' ', targetLen);
  if (lastSpace > 160) {
    return window.slice(0, lastSpace).trimEnd();
  }
  return window.slice(0, targetLen).trimEnd();
}

export function splitStockAnalysisMarkdown(markdown: string): {
  /** Shorter markdown shown when collapsed. */
  overviewMarkdown: string;
  /** Full original markdown. */
  fullMarkdown: string;
  /** When true, show "Show more" / "Show less". */
  canExpand: boolean;
} {
  const fullMarkdown = markdown.replace(/\r\n/g, '\n').trim();
  if (!fullMarkdown) {
    return { overviewMarkdown: '', fullMarkdown, canExpand: false };
  }

  const lines = fullMarkdown.split('\n');
  let overviewIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isOverviewHeaderLine(lines[i])) {
      overviewIdx = i;
      break;
    }
  }

  let overviewMarkdown = fullMarkdown;
  let canExpand = false;

  if (overviewIdx >= 0) {
    let nextSectionIdx = -1;
    for (let j = overviewIdx + 1; j < lines.length; j++) {
      if (isFollowingSectionLine(lines[j])) {
        nextSectionIdx = j;
        break;
      }
    }
    if (nextSectionIdx >= 0) {
      overviewMarkdown = lines.slice(0, nextSectionIdx).join('\n').trimEnd();
      const rest = lines.slice(nextSectionIdx).join('\n').trim();
      canExpand = rest.length > 0;
    }
  }

  if (!canExpand && fullMarkdown.length > MIN_CHARS_FOR_FALLBACK) {
    const preview = truncateForFallback(fullMarkdown, FALLBACK_PREVIEW_TARGET);
    if (preview.length + 60 < fullMarkdown.length) {
      return {
        overviewMarkdown: preview,
        fullMarkdown,
        canExpand: true,
      };
    }
  }

  return {
    overviewMarkdown,
    fullMarkdown,
    canExpand,
  };
}
