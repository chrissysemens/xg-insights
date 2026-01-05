import { HighlightReason } from "@/types";

export const highlightMeta = (reason?: HighlightReason) => {
  switch (reason) {
    case HighlightReason.CLEAR_FAVOURITE:
      return { label: "Clear favourite", tone: "primary" as const, icon: "↑" };
    case HighlightReason.HIGH_GOALS:
      return { label: "High goals", tone: "warning" as const, icon: "⚡" };
    case HighlightReason.BTTS_LIKELY:
      return { label: "BTTS likely", tone: "success" as const, icon: "✓" };
    default:
      return { label: "Highlighted", tone: "muted" as const, icon: "•" };
  }
};

export const chipStyleForTone = (
  tone: "primary" | "success" | "warning" | "muted",
  c: any
) => {
  switch (tone) {
    case "success":
      return { bg: c.successSoft, fg: c.success, border: c.border };
    case "warning":
      return { bg: c.warningSoft, fg: c.warning, border: c.border };
    case "primary":
      return { bg: c.primarySoft, fg: c.primary, border: c.border };
    default:
      return { bg: c.surface2, fg: c.text2, border: c.border };
  }
};