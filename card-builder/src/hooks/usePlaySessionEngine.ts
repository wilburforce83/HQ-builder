"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import {
  DEFAULT_PLAY_SESSION_STATE,
  findEntitiesInRegion,
  getVisibleRegionAt,
  playSessionReducer,
  type PlaySessionState,
  type QuestItem,
  type RevealedCard,
  type TileCoord,
} from "@/lib/play-session-engine";
import { resolveLogicActions, type LogicTrigger } from "@/lib/quest-logic-engine";
import type { IconLogic, QuestNote } from "@/types/quest";

type EntityInfo = {
  id: string;
  title: string;
  subtitle?: string;
  isDoor?: boolean;
};

type CardSummary = {
  id: string;
  title?: string | null;
  name?: string | null;
};

type UsePlaySessionEngineOptions = {
  storageKey: string;
  items: QuestItem[];
  entityInfoById: Map<string, EntityInfo>;
  iconLogic?: IconLogic[];
  notes?: QuestNote[];
  cardsById?: Map<string, CardSummary>;
  columns?: number;
  rows?: number;
};

function loadState(storageKey: string): PlaySessionState {
  if (typeof window === "undefined") return DEFAULT_PLAY_SESSION_STATE;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_PLAY_SESSION_STATE;
    const parsed = JSON.parse(raw) as Partial<PlaySessionState> | null;
    if (!parsed || typeof parsed !== "object") return DEFAULT_PLAY_SESSION_STATE;
    return {
      discoveredTiles: Array.isArray(parsed.discoveredTiles) ? parsed.discoveredTiles : [],
      revealedEntities: Array.isArray(parsed.revealedEntities) ? parsed.revealedEntities : [],
      revealedCards: Array.isArray(parsed.revealedCards) ? parsed.revealedCards : [],
      flags:
        parsed.flags && typeof parsed.flags === "object"
          ? Object.fromEntries(
              Object.entries(parsed.flags as Record<string, unknown>).filter(
                ([, value]) => typeof value === "boolean",
              ),
            )
          : {},
      narratives: Array.isArray(parsed.narratives) ? parsed.narratives : [],
      objectives: Array.isArray(parsed.objectives) ? parsed.objectives : [],
      heroTokens: Array.isArray(parsed.heroTokens) ? parsed.heroTokens : [],
      entityPositions:
        parsed.entityPositions && typeof parsed.entityPositions === "object"
          ? (parsed.entityPositions as Record<string, { x: number; y: number }>)
          : {},
      movementTrail: Array.isArray(parsed.movementTrail) ? parsed.movementTrail : [],
      openDoors: Array.isArray(parsed.openDoors) ? parsed.openDoors : [],
    };
  } catch {
    return DEFAULT_PLAY_SESSION_STATE;
  }
}

function toCard(info: EntityInfo): RevealedCard {
  return {
    id: info.id,
    title: info.title,
    subtitle: info.subtitle,
    entityId: info.id,
    revealedAt: Date.now(),
  };
}

export function usePlaySessionEngine({
  storageKey,
  items,
  entityInfoById,
  iconLogic = [],
  notes = [],
  cardsById = new Map(),
  columns = 26,
  rows = 19,
}: UsePlaySessionEngineOptions) {
  const [state, dispatch] = useReducer(
    playSessionReducer,
    storageKey,
    () => loadState(storageKey),
  );
  const hasStartedRef = useRef(false);

  useEffect(() => {
    dispatch({ type: "reset", state: loadState(storageKey) });
    hasStartedRef.current = false;
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, storageKey]);

  const revealTiles = useCallback((tiles: TileCoord[]) => {
    if (!tiles.length) return;
    dispatch({ type: "revealTiles", tiles });
  }, []);

  const revealEntity = useCallback(
    (entityId: string) => {
      const info = entityInfoById.get(entityId);
      dispatch({
        type: "revealEntity",
        entityId,
        card: info ? toCard(info) : null,
      });
    },
    [entityInfoById],
  );

  const revealCard = useCallback(
    (cardId: string) => {
      const card = cardsById.get(cardId);
      const title = card?.title || card?.name || cardId;
      dispatch({
        type: "revealCard",
        card: {
          id: cardId,
          title,
          revealedAt: Date.now(),
        },
      });
    },
    [cardsById],
  );

  const setFlag = useCallback((flag: string) => {
    if (!flag) return;
    dispatch({ type: "setFlag", flag });
  }, []);

  const clearFlag = useCallback((flag: string) => {
    if (!flag) return;
    dispatch({ type: "clearFlag", flag });
  }, []);

  const addNarrative = useCallback((noteIds: string[]) => {
    if (!noteIds.length) return;
    dispatch({ type: "addNarrative", noteIds });
  }, []);

  const addObjective = useCallback((objectiveId: string) => {
    if (!objectiveId) return;
    dispatch({ type: "addObjective", objectiveId });
  }, []);

  const addHero = useCallback((hero: { id: string; assetId: string; name: string; x: number; y: number }) => {
    if (!hero || !hero.id) return;
    dispatch({ type: "addHero", hero });
  }, []);

  const moveEntity = useCallback(
    (entityId: string, position: TileCoord, trail?: TileCoord[]) => {
      if (!entityId || !position) return;
      dispatch({ type: "moveEntity", entityId, position, trail });
    },
    [],
  );

  const clearMovementTrail = useCallback(() => {
    dispatch({ type: "clearMovementTrail" });
  }, []);

  const openDoor = useCallback((doorId: string) => {
    if (!doorId) return;
    dispatch({ type: "openDoor", doorId });
  }, []);

  const getVisibleRegion = useCallback(
    (position: TileCoord, rules?: { radius?: number }) =>
      getVisibleRegionAt(position, { ...rules, columns, rows }),
    [columns, rows],
  );

  const revealEntitiesInRegion = useCallback(
    (region: TileCoord[]) => {
      const entities = findEntitiesInRegion(items, region);
      entities.forEach((entityId) => {
        revealEntity(entityId);
      });
    },
    [items, revealEntity],
  );

  const hasLogic = iconLogic.length > 0;

  const applyLogicTrigger = useCallback(
    (trigger: LogicTrigger) => {
      if (!hasLogic) return;
      const resolution = resolveLogicActions({
        trigger,
        iconLogic,
        items,
        flags: state.flags,
        notes,
        columns,
        rows,
      });

      if (resolution.revealTiles.length) {
        revealTiles(resolution.revealTiles);
      }
      resolution.revealEntities.forEach((entityId) => revealEntity(entityId));
      resolution.cardIds.forEach((cardId) => revealCard(cardId));
      if (resolution.noteIds.length) addNarrative(resolution.noteIds);
      resolution.flagsToSet.forEach((flag) => setFlag(flag));
      resolution.flagsToClear.forEach((flag) => clearFlag(flag));
      resolution.objectives.forEach((objectiveId) => addObjective(objectiveId));
    },
    [
      addNarrative,
      addObjective,
      clearFlag,
      hasLogic,
      iconLogic,
      items,
      notes,
      revealCard,
      revealEntity,
      revealTiles,
      setFlag,
      state.flags,
    ],
  );

  useEffect(() => {
    if (!hasLogic) return;
    if (hasStartedRef.current) return;
    const isFreshSession =
      state.discoveredTiles.length === 0 &&
      state.revealedEntities.length === 0 &&
      state.revealedCards.length === 0 &&
      state.narratives.length === 0 &&
      state.objectives.length === 0 &&
      Object.keys(state.flags ?? {}).length === 0 &&
      state.heroTokens.length === 0 &&
      Object.keys(state.entityPositions ?? {}).length === 0 &&
      state.movementTrail.length === 0 &&
      state.openDoors.length === 0;
    if (!isFreshSession) {
      hasStartedRef.current = true;
      return;
    }
    hasStartedRef.current = true;
    applyLogicTrigger({ type: "onStart" });
  }, [
    applyLogicTrigger,
    hasLogic,
    state.discoveredTiles.length,
    state.flags,
    state.heroTokens.length,
    state.entityPositions,
    state.movementTrail.length,
    state.openDoors.length,
    state.narratives.length,
    state.objectives.length,
    state.revealedCards.length,
    state.revealedEntities.length,
  ]);

  const handleSearchAction = useCallback(
    (position: TileCoord | null) => {
      if (!position) return;
      const region = getVisibleRegion(position, { radius: 1 });
      revealTiles(region);
      if (hasLogic) {
        applyLogicTrigger({ type: "onSearch", tiles: region });
        applyLogicTrigger({ type: "onReveal", tiles: region });
      } else {
        revealEntitiesInRegion(region);
      }
    },
    [applyLogicTrigger, getVisibleRegion, hasLogic, revealEntitiesInRegion, revealTiles],
  );

  const handleOpenDoor = useCallback(
    (position: TileCoord | null) => {
      if (!position) return;
      const region = getVisibleRegion(position, { radius: 1 });
      const doorEntities = findEntitiesInRegion(items, region).filter((entityId) => {
        const info = entityInfoById.get(entityId);
        return Boolean(info?.isDoor);
      });
      if (!doorEntities.length) return;
      doorEntities.forEach((entityId) => {
        revealEntity(entityId);
        openDoor(entityId);
      });
      const doorPositions = doorEntities
        .map((entityId) => items.find((item) => item.id === entityId))
        .filter(Boolean) as QuestItem[];
      if (hasLogic) {
        applyLogicTrigger({ type: "onOpenDoor", entityIds: doorEntities });
      }
      doorPositions.forEach((door) => {
        const revealRegion = getVisibleRegion({ x: door.x, y: door.y }, { radius: 2 });
        revealTiles(revealRegion);
        if (hasLogic) {
          applyLogicTrigger({ type: "onReveal", tiles: revealRegion });
        } else {
          revealEntitiesInRegion(revealRegion);
        }
      });
    },
    [
      applyLogicTrigger,
      entityInfoById,
      getVisibleRegion,
      hasLogic,
      items,
      revealEntitiesInRegion,
      revealEntity,
      revealTiles,
      openDoor,
    ],
  );

  const handleEnterTile = useCallback(
    (position: TileCoord | null, triggerTiles?: TileCoord[]) => {
      if (!position) return;
      const revealTilesList = [position];
      const tilesForTrigger = triggerTiles && triggerTiles.length ? triggerTiles : revealTilesList;
      revealTiles(revealTilesList);
      if (hasLogic) {
        applyLogicTrigger({ type: "onEnterTile", tiles: tilesForTrigger });
        applyLogicTrigger({ type: "onReveal", tiles: revealTilesList });
      } else {
        revealEntitiesInRegion(tilesForTrigger);
      }
    },
    [applyLogicTrigger, hasLogic, revealEntitiesInRegion, revealTiles],
  );

  const resetSession = useCallback(() => {
    dispatch({ type: "reset", state: DEFAULT_PLAY_SESSION_STATE });
  }, []);

  const restartSession = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
    }
    hasStartedRef.current = false;
    dispatch({ type: "reset", state: DEFAULT_PLAY_SESSION_STATE });
  }, [storageKey]);

  return useMemo(
    () => ({
      state,
      revealTiles,
      revealEntity,
      revealCard,
      getVisibleRegionAt: getVisibleRegion,
      handleSearchAction,
      handleOpenDoor,
      handleEnterTile,
      applyLogicTrigger,
      addHero,
      moveEntity,
      clearMovementTrail,
      openDoor,
      resetSession,
      restartSession,
    }),
    [
      state,
      revealTiles,
      revealEntity,
      revealCard,
      getVisibleRegion,
      handleSearchAction,
      handleOpenDoor,
      handleEnterTile,
      applyLogicTrigger,
      addHero,
      moveEntity,
      clearMovementTrail,
      openDoor,
      resetSession,
      restartSession,
    ],
  );
}
