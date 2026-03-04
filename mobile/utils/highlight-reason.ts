import { HighlightReason, ResultPick } from '@/types';

/**
 * Returns the highlight reason metadata for display purposes.
 * @param reason - highlight reason
 * @returns - metadata including label key, tone, and icon
 */
export const highlightMeta = (reason?: HighlightReason) => {
  switch (reason) {
    case HighlightReason.CLEAR_FAVOURITE:
      return {
        labelKey: 'home.matchWinner',
        tone: 'primary' as const,
        icon: '↑',
      };
    case HighlightReason.HIGH_GOALS:
      return {
        labelKey: 'home.highGoals',
        tone: 'warning' as const,
        icon: '⚡',
      };
    case HighlightReason.BTTS_LIKELY:
      return {
        labelKey: 'home.bttsLikely',
        tone: 'success' as const,
        icon: '⚽',
      };
    default:
      return {
        labelKey: 'home.highlighted',
        tone: 'muted' as const,
        icon: '•',
      };
  }
};

/**
 * Returns badge styles based on the tone.
 * @param tone - tone of the badge
 * @param c - theme colours
 * @returns - styles for background, foreground, and border
 */
export const chipStyleForTone = (
  tone: 'primary' | 'success' | 'warning' | 'muted',
  c: any,
) => {
  switch (tone) {
    case 'success':
      return { bg: c.successSoft, fg: c.success, border: c.border };
    case 'warning':
      return { bg: c.warningSoft, fg: c.warning, border: c.border };
    case 'primary':
      return { bg: c.primarySoft, fg: c.primary, border: c.border };
    default:
      return { bg: c.surface2, fg: c.text2, border: c.border };
  }
};

/**
 * Formats a kickoff timestamp into a human-readable string.
 * @param ts - kickoff timestamp in seconds
 * @returns - formatted date string
 */
export const formatKickoff = (ts: number) => {
  const d = new Date(ts * 1000);
  const day = d.toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${day} ${time}`;
};

/**
 * Returns the confidence 
 * @param p 
 * @returns 
 */
export const getResultConf = (p: any) =>
  Math.max(p?.matchResult?.H ?? 0, p?.matchResult?.D ?? 0, p?.matchResult?.A ?? 0);

export const roundToNearest25 = (p: number) => Math.round(p / 2.5) * 2.5;

export const teamStyle = (which: 'home' | 'away', pick?: ResultPick, c?: any) => {
  if (!pick || pick === 'D') return { color: c.text };
  if (pick === 'H' && which === 'home') return { color: c.primary };
  if (pick === 'A' && which === 'away') return { color: c.primary };
  return { color: c.text };
};
