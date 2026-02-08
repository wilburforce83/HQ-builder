export type TileCoord = {
  x: number;
  y: number;
};

export type QuestItem = {
  id: string;
  assetId: string;
  x: number;
  y: number;
  baseW: number;
  baseH: number;
  spanW?: number;
  spanH?: number;
  rotation?: number;
  offsetX?: number;
  offsetY?: number;
  layer?: "tile" | "furniture" | "monster";
};

export type RevealedCard = {
  id: string;
  title: string;
  subtitle?: string;
  entityId?: string;
  revealedAt: number;
};

export type HeroToken = {
  id: string;
  assetId: string;
  name: string;
  x: number;
  y: number;
  rotation?: number;
};

export type PlaySessionState = {
  discoveredTiles: string[];
  revealedEntities: string[];
  revealedCards: RevealedCard[];
  flags: Record<string, boolean>;
  narratives: string[];
  objectives: string[];
  heroTokens: HeroToken[];
  entityPositions: Record<string, TileCoord>;
  movementTrail: TileCoord[];
  openDoors: string[];
};

export const DEFAULT_PLAY_SESSION_STATE: PlaySessionState = {
  discoveredTiles: [],
  revealedEntities: [],
  revealedCards: [],
  flags: {},
  narratives: [],
  objectives: [],
  heroTokens: [],
  entityPositions: {},
  movementTrail: [],
  openDoors: [],
};

export type PlaySessionAction =
  | { type: "reset"; state: PlaySessionState }
  | { type: "revealTiles"; tiles: TileCoord[] }
  | { type: "revealEntity"; entityId: string; card?: RevealedCard | null }
  | { type: "revealCard"; card: RevealedCard }
  | { type: "setFlag"; flag: string }
  | { type: "clearFlag"; flag: string }
  | { type: "addNarrative"; noteIds: string[] }
  | { type: "addObjective"; objectiveId: string }
  | { type: "addHero"; hero: HeroToken }
  | { type: "moveEntity"; entityId: string; position: TileCoord; trail?: TileCoord[] }
  | { type: "clearMovementTrail" }
  | { type: "openDoor"; doorId: string };

const EPSILON = 0.0001;

export function tileKey(tile: TileCoord): string {
  return `${tile.x},${tile.y}`;
}

export function parseTileKey(key: string): TileCoord {
  const [xRaw, yRaw] = key.split(",");
  return { x: Number.parseInt(xRaw ?? "0", 10), y: Number.parseInt(yRaw ?? "0", 10) };
}

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of items) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function mergeStrings(base: string[], add: string[]): string[] {
  if (add.length === 0) return base;
  return uniqueStrings([...base, ...add]);
}

function mergeCards(base: RevealedCard[], card?: RevealedCard | null): RevealedCard[] {
  if (!card) return base;
  if (base.some((entry) => entry.id === card.id)) return base;
  return [...base, card];
}

function mergeDoorIds(base: string[], doorId: string) {
  if (!doorId) return base;
  if (base.includes(doorId)) return base;
  return [...base, doorId];
}

function setFlagValue(flags: Record<string, boolean>, flag: string, value: boolean) {
  if (!flag) return flags;
  if (flags[flag] === value) return flags;
  return { ...flags, [flag]: value };
}

function normalizeHeroTokens(tokens: HeroToken[]) {
  if (!Array.isArray(tokens)) return [];
  return tokens.filter(
    (token) =>
      token &&
      typeof token.id === "string" &&
      typeof token.assetId === "string" &&
      Number.isFinite(token.x) &&
      Number.isFinite(token.y),
  );
}

function normalizeEntityPositions(raw: Record<string, TileCoord> | null | undefined) {
  if (!raw || typeof raw !== "object") return {};
  const entries = Object.entries(raw).filter(([, value]) => {
    return value && Number.isFinite(value.x) && Number.isFinite(value.y);
  });
  return Object.fromEntries(entries) as Record<string, TileCoord>;
}

function normalizeTrail(trail: TileCoord[] | null | undefined) {
  if (!Array.isArray(trail)) return [];
  return trail.filter(
    (coord) => coord && Number.isFinite(coord.x) && Number.isFinite(coord.y),
  );
}

export function playSessionReducer(
  state: PlaySessionState,
  action: PlaySessionAction,
): PlaySessionState {
  switch (action.type) {
    case "reset":
      return {
        discoveredTiles: uniqueStrings(action.state.discoveredTiles ?? []),
        revealedEntities: uniqueStrings(action.state.revealedEntities ?? []),
        revealedCards: action.state.revealedCards ?? [],
        flags: action.state.flags ?? {},
        narratives: uniqueStrings(action.state.narratives ?? []),
        objectives: uniqueStrings(action.state.objectives ?? []),
        heroTokens: normalizeHeroTokens(action.state.heroTokens ?? []),
        entityPositions: normalizeEntityPositions(action.state.entityPositions ?? {}),
        movementTrail: normalizeTrail(action.state.movementTrail ?? []),
        openDoors: uniqueStrings(action.state.openDoors ?? []),
      };
    case "revealTiles": {
      const keys = action.tiles.map(tileKey);
      return {
        ...state,
        discoveredTiles: mergeStrings(state.discoveredTiles, keys),
      };
    }
    case "revealEntity": {
      return {
        ...state,
        revealedEntities: mergeStrings(state.revealedEntities, [action.entityId]),
        revealedCards: mergeCards(state.revealedCards, action.card ?? null),
      };
    }
    case "revealCard": {
      return {
        ...state,
        revealedCards: mergeCards(state.revealedCards, action.card),
      };
    }
    case "setFlag":
      return {
        ...state,
        flags: setFlagValue(state.flags, action.flag, true),
      };
    case "clearFlag":
      return {
        ...state,
        flags: setFlagValue(state.flags, action.flag, false),
      };
    case "addNarrative":
      return {
        ...state,
        narratives: mergeStrings(state.narratives, action.noteIds ?? []),
      };
    case "addObjective":
      return {
        ...state,
        objectives: mergeStrings(state.objectives, [action.objectiveId]),
      };
    case "addHero": {
      if (state.heroTokens.some((token) => token.id === action.hero.id)) return state;
      return {
        ...state,
        heroTokens: [...state.heroTokens, action.hero],
      };
    }
    case "moveEntity": {
      const { entityId, position, trail } = action;
      const nextPositions = {
        ...state.entityPositions,
        [entityId]: position,
      };
      const nextHeroes = state.heroTokens.map((token) =>
        token.id === entityId ? { ...token, x: position.x, y: position.y } : token,
      );
      return {
        ...state,
        heroTokens: nextHeroes,
        entityPositions: nextPositions,
        movementTrail: normalizeTrail(trail ?? []),
      };
    }
    case "clearMovementTrail":
      return {
        ...state,
        movementTrail: [],
      };
    case "openDoor":
      return {
        ...state,
        openDoors: mergeDoorIds(state.openDoors, action.doorId),
      };
    default:
      return state;
  }
}

export function getVisibleRegionAt(
  position: TileCoord,
  rules?: { radius?: number; columns?: number; rows?: number },
): TileCoord[] {
  const radius = rules?.radius ?? 1;
  const columns = rules?.columns ?? 26;
  const rows = rules?.rows ?? 19;
  const tiles: TileCoord[] = [];
  for (let y = position.y - radius; y <= position.y + radius; y += 1) {
    for (let x = position.x - radius; x <= position.x + radius; x += 1) {
      if (x < 0 || y < 0 || x >= columns || y >= rows) continue;
      tiles.push({ x, y });
    }
  }
  return tiles;
}

export function spanForRotation(baseW: number, baseH: number, rotation = 0) {
  const normalized = Math.abs(rotation) % 180;
  if (normalized < EPSILON) {
    return { w: baseW, h: baseH };
  }
  return { w: baseH, h: baseW };
}

export function getItemSpan(item: QuestItem) {
  if (
    typeof item.spanW === "number" &&
    Number.isFinite(item.spanW) &&
    typeof item.spanH === "number" &&
    Number.isFinite(item.spanH)
  ) {
    return { w: item.spanW, h: item.spanH };
  }
  return spanForRotation(item.baseW, item.baseH, item.rotation ?? 0);
}

export function getItemTiles(item: QuestItem): TileCoord[] {
  const span = getItemSpan(item);
  const tiles: TileCoord[] = [];
  for (let y = item.y; y < item.y + span.h; y += 1) {
    for (let x = item.x; x < item.x + span.w; x += 1) {
      tiles.push({ x, y });
    }
  }
  return tiles;
}

export function findEntitiesInRegion(items: QuestItem[], region: TileCoord[]): string[] {
  if (region.length === 0) return [];
  const regionKeys = new Set(region.map(tileKey));
  const matches: string[] = [];
  for (const item of items) {
    const tiles = getItemTiles(item);
    if (tiles.some((tile) => regionKeys.has(tileKey(tile)))) {
      matches.push(item.id);
    }
  }
  return matches;
}
