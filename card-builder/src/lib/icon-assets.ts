export const ICON_TYPE_OPTIONS = [
  "Monster",
  "Boss",
  "NPC",
  "Hero",
  "Minion",
  "Ally",
  "Villain",
  "Trap",
  "Item",
  "Objective",
  "Other",
] as const;

const ICON_TOKEN = /(?:^|[ _-])icon$/i;
const ICON_CHECK = /icon/i;

function normalizeWord(word: string): string {
  if (!word) return "";
  const lower = word.toLowerCase();
  if (lower === "npc") return "NPC";
  if (word.length <= 2) return word.toUpperCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => normalizeWord(word))
    .join(" ");
}

export function isIconFilename(name: string): boolean {
  return ICON_CHECK.test(name);
}

export function parseIconMetaFromFilename(name: string): {
  iconType?: string;
  iconName?: string;
} {
  const base = name.replace(/\.[^/.]+$/, "");
  if (!isIconFilename(base)) return {};

  let trimmed = base.replace(ICON_TOKEN, "");
  trimmed = trimmed.replace(/[_-]+/g, " ");
  trimmed = trimmed.replace(/\s+/g, " ").trim();

  if (!trimmed) return {};

  const parts = trimmed.split(" ").filter(Boolean);
  if (parts.length === 0) return {};

  const rawType = parts.shift();
  const rawName = parts.join(" ").trim();

  const iconType = rawType ? titleCase(rawType) : undefined;
  const iconName = rawName ? titleCase(rawName) : undefined;

  return { iconType, iconName };
}

export function formatIconLabel(asset: {
  name: string;
  iconType?: string | null;
  iconName?: string | null;
}): string {
  const type = asset.iconType ?? "";
  const name = asset.iconName ?? "";

  if (type && name) return `${type}: ${name}`;
  if (name) return name;
  if (type) return type;
  return asset.name;
}
