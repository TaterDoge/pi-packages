import { Card, CardContent } from "@taterdoge/ui/components/ui/card";
import { Input } from "@taterdoge/ui/components/ui/input";
import { Label } from "@taterdoge/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@taterdoge/ui/components/ui/select";
import type { ConfigPayload } from "../../src/settings/protocol.ts";
import type { ContextBarStyleId } from "../../src/types.ts";

type SettingsPanelProps = {
  separator: string;
  contextBarStyle: ContextBarStyleId;
  contextBarStyles: ConfigPayload["contextBarStyles"];
  meta: ConfigPayload["meta"];
  onSeparator: (separator: string) => void;
  onContextBarStyle: (style: ContextBarStyleId) => void;
};

export function SettingsPanel({
  separator,
  contextBarStyle,
  contextBarStyles,
  meta,
  onSeparator,
  onContextBarStyle,
}: SettingsPanelProps) {
  // The TUI menu rejects a separator wider than 8 display cells; keep the same ceiling here.
  const separatorTooWide = visibleWidth(separator) > meta.maxSeparatorWidth;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-4 py-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="separator">Separator</Label>
          <Input
            id="separator"
            className="w-28 font-mono"
            value={separator}
            aria-invalid={separatorTooWide}
            onChange={(event) => onSeparator(event.target.value)}
          />
          {separatorTooWide ? (
            <p className="text-destructive text-xs">Max display width {meta.maxSeparatorWidth}.</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="context-style">Context bar</Label>
          <Select
            value={contextBarStyle}
            onValueChange={(value) => onContextBarStyle(value as ContextBarStyleId)}
          >
            <SelectTrigger id="context-style" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {contextBarStyles.map((style) => (
                <SelectItem key={style.id} value={style.id}>
                  {style.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

/** Display width of a separator: CJK and emoji take two cells, combining marks take none. */
export function visibleWidth(value: string): number {
  let width = 0;
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code === 0x200b || (code >= 0x0300 && code <= 0x036f)) continue;
    width += isWide(code) ? 2 : 1;
  }
  return width;
}

function isWide(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f300 && code <= 0x1f64f) ||
    (code >= 0x1f900 && code <= 0x1f9ff) ||
    (code >= 0x20000 && code <= 0x3fffd)
  );
}
