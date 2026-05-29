/**
 * Strip Minecraft color codes ("&#hex", "&a", "§a") from a string.
 * Mirrors what the plugin stores in `display_name_plain`.
 */
export function stripColor(input: string): string {
  return input
    .replace(/&#[0-9a-fA-F]{6}/g, "")
    .replace(/§[0-9a-fk-or]/gi, "")
    .replace(/&[0-9a-fk-or]/gi, "");
}

export type ColorRun = { text: string; color?: string };

/**
 * Parse a Minecraft-style colored string into runs of (text, color).
 * Supports "&#RRGGBB" hex codes and legacy "&a" codes (mapped to vanilla palette).
 */
export function parseColored(input: string): ColorRun[] {
  if (!input) return [];

  const legacy: Record<string, string> = {
    "0": "#000000", "1": "#0000aa", "2": "#00aa00", "3": "#00aaaa",
    "4": "#aa0000", "5": "#aa00aa", "6": "#ffaa00", "7": "#aaaaaa",
    "8": "#555555", "9": "#5555ff", a: "#55ff55", b: "#55ffff",
    c: "#ff5555", d: "#ff55ff", e: "#ffff55", f: "#ffffff",
  };

  const runs: ColorRun[] = [];
  let current: ColorRun = { text: "" };
  let i = 0;

  while (i < input.length) {
    if (input[i] === "&" && input[i + 1] === "#" && /^[0-9a-fA-F]{6}$/.test(input.slice(i + 2, i + 8))) {
      if (current.text) runs.push(current);
      current = { text: "", color: "#" + input.slice(i + 2, i + 8).toLowerCase() };
      i += 8;
    } else if ((input[i] === "&" || input[i] === "§") && legacy[input[i + 1]?.toLowerCase()]) {
      if (current.text) runs.push(current);
      current = { text: "", color: legacy[input[i + 1].toLowerCase()] };
      i += 2;
    } else if ((input[i] === "&" || input[i] === "§") && /[k-or]/i.test(input[i + 1] ?? "")) {
      // formatting codes (obfuscated, bold, etc.) — ignored for now
      i += 2;
    } else {
      current.text += input[i];
      i++;
    }
  }

  if (current.text) runs.push(current);
  return runs;
}
