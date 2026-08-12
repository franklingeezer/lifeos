export type PaletteCommand =
  | { type: "create-task"; text: string }
  | { type: "create-note"; text: string };

// Prefix syntax, forgiving of a colon or not: "task: buy milk" or
// "task buy milk" both work. Kept explicit and prefix-based (rather than
// guessing intent from any word) so it never collides with someone
// genuinely searching for something titled "task" or "note" — a search
// for a real item won't match this pattern, since the whole point of a
// command prefix is that it's unlikely to appear as an accidental substring.
const COMMAND_PATTERNS: { type: PaletteCommand["type"]; regex: RegExp }[] = [
  { type: "create-task", regex: /^task[:\s]+(.+)/i },
  { type: "create-note", regex: /^note[:\s]+(.+)/i },
];

export function parseCommand(query: string): PaletteCommand | null {
  const trimmed = query.trim();
  for (const { type, regex } of COMMAND_PATTERNS) {
    const match = trimmed.match(regex);
    if (match && match[1].trim()) {
      return { type, text: match[1].trim() };
    }
  }
  return null;
}