const STORAGE_KEY = "hq.quest.iconTypes";

function normalizeType(value: string): string {
  return value.trim();
}

export function loadCustomIconTypes(): string[] {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => (typeof value === "string" ? normalizeType(value) : ""))
      .filter((value) => value.length > 0);
  } catch {
    return [];
  }
}

export function saveCustomIconTypes(types: string[]): void {
  if (typeof window === "undefined") return;
  const normalized = types
    .map((value) => normalizeType(value))
    .filter((value) => value.length > 0);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore localStorage errors.
  }
}

export function mergeIconTypes(...lists: Array<Array<string | null | undefined>>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const list of lists) {
    for (const raw of list) {
      if (!raw) continue;
      const value = normalizeType(raw);
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(value);
    }
  }
  return result;
}
