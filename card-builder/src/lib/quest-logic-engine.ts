import {
  findEntitiesInRegion,
  getVisibleRegionAt,
  type QuestItem,
  type TileCoord,
} from "@/lib/play-session-engine";
import type { IconLogic, QuestNote } from "@/types/quest";

export type LogicTrigger = {
  type: string;
  tiles?: TileCoord[];
  entityIds?: string[];
};

export type LogicResolution = {
  revealTiles: TileCoord[];
  revealEntities: string[];
  noteIds: string[];
  cardIds: string[];
  flagsToSet: string[];
  flagsToClear: string[];
  objectives: string[];
};

type LogicContext = {
  trigger: LogicTrigger;
  iconLogic: IconLogic[];
  items: QuestItem[];
  flags: Record<string, boolean>;
  notes: QuestNote[];
  columns?: number;
  rows?: number;
};

function uniqueStrings(items: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of items) {
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function uniqueCoords(items: TileCoord[]) {
  const seen = new Set<string>();
  const result: TileCoord[] = [];
  for (const coord of items) {
    const key = `${coord.x},${coord.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(coord);
  }
  return result;
}

function conditionMatches(
  condition: { type: string; operand?: string },
  flags: Record<string, boolean>,
  noteIds: Set<string>,
) {
  const operand = condition.operand?.trim() ?? "";
  if (!operand && condition.type !== "custom") return false;

  switch (condition.type) {
    case "flagSet":
      return flags[operand] === true;
    case "flagUnset":
      return flags[operand] !== true;
    case "flagExists":
      return Object.prototype.hasOwnProperty.call(flags, operand);
    case "noteExists":
      return noteIds.has(operand);
    case "custom":
      return true;
    default:
      return false;
  }
}

function conditionsPass(entry: IconLogic, flags: Record<string, boolean>, noteIds: Set<string>) {
  const conditions = entry.conditions ?? [];
  if (conditions.length === 0) return true;
  const results = conditions.map((condition) => conditionMatches(condition, flags, noteIds));
  const mode = entry.conditionsMode ?? "all";
  if (mode === "any") {
    return results.some(Boolean);
  }
  return results.every(Boolean);
}

export function resolveLogicActions(context: LogicContext): LogicResolution {
  const { trigger, iconLogic, items, flags, notes } = context;
  const columns = context.columns ?? 26;
  const rows = context.rows ?? 19;
  const noteIds = new Set(notes.map((note) => note.id));
  const itemsById = new Map(items.map((item) => [item.id, item]));

  const matchingEntries = iconLogic.filter((entry) => entry.triggerType === trigger.type);
  if (matchingEntries.length === 0) {
    return {
      revealTiles: [],
      revealEntities: [],
      noteIds: [],
      cardIds: [],
      flagsToSet: [],
      flagsToClear: [],
      objectives: [],
    };
  }

  let targetIds: string[] = [];
  if (Array.isArray(trigger.entityIds) && trigger.entityIds.length > 0) {
    targetIds = trigger.entityIds;
  } else if (Array.isArray(trigger.tiles) && trigger.tiles.length > 0) {
    targetIds = findEntitiesInRegion(items, trigger.tiles);
  }
  const hasTargets = targetIds.length > 0;
  const targetSet = hasTargets ? new Set(targetIds) : null;

  const revealTiles: TileCoord[] = [];
  const revealEntities: string[] = [];
  const noteIdsOut: string[] = [];
  const cardIds: string[] = [];
  const flagsToSet: string[] = [];
  const flagsToClear: string[] = [];
  const objectives: string[] = [];

  for (const entry of matchingEntries) {
    if (targetSet && !targetSet.has(entry.iconId)) continue;
    if (!conditionsPass(entry, flags, noteIds)) continue;

    for (const action of entry.actions ?? []) {
      switch (action.type) {
        case "revealTiles": {
          const coords = Array.isArray(action.payload?.coords) ? action.payload.coords : [];
          for (const coord of coords) {
            if (
              coord &&
              Number.isFinite(coord.x) &&
              Number.isFinite(coord.y)
            ) {
              revealTiles.push({ x: coord.x, y: coord.y });
            }
          }
          break;
        }
        case "revealEntities": {
          const entityIds = Array.isArray(action.payload?.entityIds)
            ? action.payload.entityIds
            : [];
          for (const id of entityIds) {
            if (typeof id === "string" && id.trim()) {
              revealEntities.push(id.trim());
            }
          }
          break;
        }
        case "revealRadius": {
          const radiusRaw = action.payload?.radius;
          const radiusParsed = Number.isFinite(radiusRaw)
            ? Number(radiusRaw)
            : Number.parseInt(String(radiusRaw ?? ""), 10);
          const radius = Number.isFinite(radiusParsed) ? Math.max(1, radiusParsed) : 1;
          const origins: TileCoord[] = [];
          const item = itemsById.get(entry.iconId);
          if (item) {
            origins.push({ x: item.x, y: item.y });
          }
          if (!origins.length && Array.isArray(trigger.tiles)) {
            origins.push(...trigger.tiles);
          }
          origins.forEach((origin) => {
            const region = getVisibleRegionAt(origin, { radius, columns, rows });
            revealTiles.push(...region);
          });
          break;
        }
        case "addNarrative": {
          const noteIdsPayload = Array.isArray(action.payload?.noteIds)
            ? action.payload.noteIds
            : [];
          for (const id of noteIdsPayload) {
            if (typeof id === "string" && id.trim()) {
              noteIdsOut.push(id.trim());
            }
          }
          break;
        }
        case "revealCard": {
          const cardIdsPayload = Array.isArray(action.payload?.cardIds)
            ? action.payload.cardIds
            : [];
          for (const id of cardIdsPayload) {
            if (typeof id === "string" && id.trim()) {
              cardIds.push(id.trim());
            }
          }
          break;
        }
        case "setFlag": {
          const flag = action.payload?.flag;
          if (typeof flag === "string" && flag.trim()) {
            flagsToSet.push(flag.trim());
          }
          break;
        }
        case "clearFlag": {
          const flag = action.payload?.flag;
          if (typeof flag === "string" && flag.trim()) {
            flagsToClear.push(flag.trim());
          }
          break;
        }
        case "addObjective": {
          const objectiveId = action.payload?.objectiveId;
          if (typeof objectiveId === "string" && objectiveId.trim()) {
            objectives.push(objectiveId.trim());
          }
          break;
        }
        default:
          break;
      }
    }
  }

  return {
    revealTiles: uniqueCoords(revealTiles),
    revealEntities: uniqueStrings(revealEntities),
    noteIds: uniqueStrings(noteIdsOut),
    cardIds: uniqueStrings(cardIds),
    flagsToSet: uniqueStrings(flagsToSet),
    flagsToClear: uniqueStrings(flagsToClear),
    objectives: uniqueStrings(objectives),
  };
}
