import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

/**
 * Port of Osdy-Pi's fitBorder utility.
 *
 * Renders a horizontal border row with left/right text labels:
 *
 *   ─ leftContent ────── rightContent ─
 *
 * When right content is empty:
 *   ─ leftContent ─────────────────────
 *
 * Adaptive truncation: right content is truncated first, then left.
 */
export function fitBorder(
  left: string,
  right: string,
  width: number,
  color: (text: string) => string,
): string {
  if (width <= 0) return "";
  if (width === 1) return color("─");

  const { leftText, rightText } = shrinkBorderTexts(left, right, width);
  const fillWidth = Math.max(0, width - 2 - visibleWidth(leftText) - visibleWidth(rightText));
  return `${color("─")}${leftText}${color("─".repeat(fillWidth))}${rightText}${color("─")}`;
}

function borderOverflows(left: string, right: string, width: number): boolean {
  const fixedWidth = 2;
  const minGap = 1;
  return fixedWidth + visibleWidth(left) + visibleWidth(right) + minGap > width;
}

function trimBorderText(value: string): string {
  return truncateToWidth(value, Math.max(0, visibleWidth(value) - 1), "");
}

function shrinkBorderTexts(
  left: string,
  right: string,
  width: number,
): { leftText: string; rightText: string } {
  let leftText = left;
  let rightText = right;
  while (borderOverflows(leftText, rightText, width) && visibleWidth(rightText) > 0) {
    rightText = trimBorderText(rightText);
  }
  while (borderOverflows(leftText, rightText, width) && visibleWidth(leftText) > 0) {
    leftText = trimBorderText(leftText);
  }
  return { leftText, rightText };
}
