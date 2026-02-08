"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import HeroSelectionModal from "@/components/play/HeroSelectionModal";
import PlayMap from "@/components/play/PlayMap";
import { usePlaySessionEngine } from "@/hooks/usePlaySessionEngine";
import {
  findEntitiesInRegion,
  getVisibleRegionAt,
  getItemTiles,
  tileKey,
  type QuestItem,
  type TileCoord,
} from "@/lib/play-session-engine";
import { formatIconLabel } from "@/lib/icon-assets";
import { listCards } from "@/lib/cards-db";
import boardData from "@/data/boardData";
import type { CardRecord } from "@/types/cards-db";
import type { IconLogic, QuestNote } from "@/types/quest";
import styles from "@/app/play.module.css";

type AssetLike = {
  id: string;
  name: string;
  category?: string | null;
  iconType?: string | null;
  iconName?: string | null;
};

export type PlaySessionQuest = {
  id: string;
  title?: string | null;
  campaign?: string | null;
  author?: string | null;
  notes?: QuestNote[] | string | null;
  data?: {
    items: QuestItem[];
    wandering?: { assetId: string; source: "builtin" | "custom" } | null;
    iconLogic?: IconLogic[] | null;
  } | null;
};

type PlaySessionViewProps = {
  quest: PlaySessionQuest;
  assets: AssetLike[];
  storageKey: string;
  variant?: "page" | "modal";
};

function buildEntityTitle(item: QuestItem, asset?: AssetLike) {
  if (asset) return formatIconLabel(asset);
  return item.assetId;
}

function isDoorEntity(item: QuestItem, asset?: AssetLike) {
  const assetId = item.assetId.toLowerCase();
  if (assetId.includes("secret-door") || assetId.includes("secret_door")) return true;
  if (assetId.includes("door")) return true;
  if (!asset) return false;
  const name = `${asset.name} ${asset.iconName ?? ""}`.toLowerCase();
  if (name.includes("secret door")) return true;
  if (name.includes("door")) return true;
  return asset.id.toLowerCase().includes("door");
}

function isHeroAsset(asset: AssetLike) {
  if (asset.category === "hero") return true;
  if (asset.id.toLowerCase().startsWith("hero-")) return true;
  const iconType = asset.iconType?.toLowerCase();
  if (iconType === "hero") return true;
  const name = `${asset.name} ${asset.iconName ?? ""}`.toLowerCase();
  return name.includes("hero");
}

type DoorInfo = {
  id: string;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  isSecret: boolean;
};

const SEARCH_RADIUS = 6;

function isDoorItem(item: QuestItem, asset?: AssetLike) {
  const assetId = item.assetId.toLowerCase();
  if (assetId.includes("door")) return true;
  if (!asset) return false;
  const name = `${asset.name} ${asset.iconName ?? ""}`.toLowerCase();
  return name.includes("door");
}

function isSecretDoor(item: QuestItem, asset?: AssetLike) {
  const assetId = item.assetId.toLowerCase();
  if (assetId.includes("secret")) return true;
  if (!asset) return false;
  const name = `${asset.name} ${asset.iconName ?? ""}`.toLowerCase();
  return name.includes("secret");
}

function normalizeHeroKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function resolveHeroIcon(card: CardRecord, heroAssets: AssetLike[]): string {
  if (!heroAssets.length) return "";
  if (card.imageAssetId) {
    const direct = heroAssets.find((asset) => asset.id === card.imageAssetId);
    if (direct) return direct.id;
  }
  if (card.imageAssetName) {
    const target = normalizeHeroKey(card.imageAssetName);
    const match = heroAssets.find(
      (asset) => normalizeHeroKey(asset.name) === target,
    );
    if (match) return match.id;
  }
  const labelRaw = normalizeHeroKey(card.title || card.name || "");
  const labelNoHero = labelRaw.replace(/^hero/, "").replace(/hero$/, "");
  const labels = [labelRaw, labelNoHero].filter(Boolean);
  for (const label of labels) {
    const byName = heroAssets.find((asset) => normalizeHeroKey(asset.name) === label);
    if (byName) return byName.id;
    const byIconName = heroAssets.find(
      (asset) => normalizeHeroKey(asset.iconName ?? "") === label,
    );
    if (byIconName) return byIconName.id;
    const byId = heroAssets.find((asset) => normalizeHeroKey(asset.id).includes(label));
    if (byId) return byId.id;
  }
  return heroAssets[0]?.id ?? "";
}

export default function PlaySessionView({
  quest,
  assets,
  storageKey,
  variant = "page",
}: PlaySessionViewProps) {
  const items = quest.data?.items ?? [];
  const iconLogic = Array.isArray(quest.data?.iconLogic) ? quest.data?.iconLogic : [];
  const notes = Array.isArray(quest.notes) ? quest.notes : [];
  const hiddenEntityIds = useMemo(
    () =>
      new Set(
        iconLogic
          .filter((entry) => entry.triggerType === "onSearch")
          .map((entry) => entry.iconId),
      ),
    [iconLogic],
  );
  const assetsById = useMemo(() => {
    const map = new Map<string, AssetLike>();
    assets.forEach((asset) => map.set(asset.id, asset));
    return map;
  }, [assets]);

  const [cards, setCards] = useState<CardRecord[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedTile, setSelectedTile] = useState<TileCoord | null>(null);
  const [selectedHeroCardId, setSelectedHeroCardId] = useState<string | null>(null);
  const [selectedHeroIconId, setSelectedHeroIconId] = useState<string>("");
  const [heroIconByCardId, setHeroIconByCardId] = useState<Record<string, string>>({});
  const [moveRange, setMoveRange] = useState(8);
  const [sessionPhase, setSessionPhase] = useState<"setup" | "active">("setup");
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [resumeHasHeroes, setResumeHasHeroes] = useState(false);
  const [resumeChecked, setResumeChecked] = useState(false);
  const maxHeroes = 5;

  useEffect(() => {
    let active = true;
    listCards()
      .then((data) => {
        if (!active) return;
        setCards(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!active) return;
        setCards([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const cardsById = useMemo(() => {
    const map = new Map<string, { id: string; title?: string | null; name?: string | null }>();
    cards.forEach((card) =>
      map.set(card.id, { id: card.id, title: card.title, name: card.name }),
    );
    return map;
  }, [cards]);

  const heroAssets = useMemo(() => assets.filter((asset) => isHeroAsset(asset)), [assets]);

  const heroCards = useMemo(
    () => cards.filter((card) => card.templateId === "hero" && card.status !== "archived"),
    [cards],
  );

  const heroCardsById = useMemo(() => {
    const map = new Map<string, CardRecord>();
    heroCards.forEach((card) => map.set(card.id, card));
    return map;
  }, [heroCards]);

  const selectedHeroCard = useMemo(() => {
    if (!selectedHeroCardId) return null;
    return heroCardsById.get(selectedHeroCardId) ?? null;
  }, [heroCardsById, selectedHeroCardId]);

  const entityInfoById = useMemo(() => {
    const map = new Map<string, { id: string; title: string; subtitle?: string; isDoor?: boolean }>();
    items.forEach((item) => {
      const asset = assetsById.get(item.assetId);
      map.set(item.id, {
        id: item.id,
        title: buildEntityTitle(item, asset),
        subtitle: asset?.name && asset?.name !== item.assetId ? asset.name : undefined,
        isDoor: isDoorEntity(item, asset),
      });
    });
    return map;
  }, [assetsById, items]);

  const engine = usePlaySessionEngine({
    storageKey,
    items,
    entityInfoById,
    iconLogic,
    notes,
    cardsById,
  });

  const controlsDisabled = sessionPhase !== "active";
  const heroModalOpen = resumeChecked && !showResumePrompt && sessionPhase === "setup";

  const handleContinueSession = () => {
    setShowResumePrompt(false);
    setSessionPhase(resumeHasHeroes ? "active" : "setup");
  };

  const handleRestartSession = () => {
    engine.restartSession();
    setShowResumePrompt(false);
    setSessionPhase("setup");
    setSelectedEntityId(null);
    setSelectedTile(null);
    setResumeHasHeroes(false);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    setResumeChecked(false);
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setSessionPhase("setup");
      setShowResumePrompt(false);
      setResumeChecked(true);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<{
        discoveredTiles: string[];
        revealedEntities: string[];
        revealedCards: unknown[];
        flags: Record<string, boolean>;
        narratives: string[];
        objectives: string[];
        heroTokens: unknown[];
        entityPositions: Record<string, unknown>;
        movementTrail: unknown[];
        openDoors: string[];
      }>;
      const hasProgress =
        (parsed.discoveredTiles?.length ?? 0) > 0 ||
        (parsed.revealedEntities?.length ?? 0) > 0 ||
        (parsed.revealedCards?.length ?? 0) > 0 ||
        (parsed.narratives?.length ?? 0) > 0 ||
        (parsed.objectives?.length ?? 0) > 0 ||
        (parsed.heroTokens?.length ?? 0) > 0 ||
        (parsed.movementTrail?.length ?? 0) > 0 ||
        (parsed.openDoors?.length ?? 0) > 0 ||
        (parsed.flags ? Object.keys(parsed.flags).length > 0 : false) ||
        (parsed.entityPositions ? Object.keys(parsed.entityPositions).length > 0 : false);
      if (hasProgress) {
        setResumeHasHeroes((parsed.heroTokens?.length ?? 0) > 0);
        setShowResumePrompt(true);
      } else {
        setSessionPhase("setup");
        setShowResumePrompt(false);
      }
    } catch {
      setSessionPhase("setup");
      setShowResumePrompt(false);
    }
    setResumeChecked(true);
  }, [storageKey]);

  useEffect(() => {
    if (!heroCards.length) {
      setSelectedHeroCardId(null);
      return;
    }
    if (selectedHeroCardId && heroCardsById.has(selectedHeroCardId)) return;
    setSelectedHeroCardId(heroCards[0].id);
  }, [heroCards, heroCardsById, selectedHeroCardId]);

  useEffect(() => {
    if (!selectedHeroCardId) {
      setSelectedHeroIconId("");
      return;
    }
    const stored = heroIconByCardId[selectedHeroCardId];
    if (stored && heroAssets.some((asset) => asset.id === stored)) {
      setSelectedHeroIconId(stored);
      return;
    }
    const card = heroCardsById.get(selectedHeroCardId);
    if (!card) {
      setSelectedHeroIconId("");
      return;
    }
    setSelectedHeroIconId(resolveHeroIcon(card, heroAssets));
  }, [heroAssets, heroCardsById, heroIconByCardId, selectedHeroCardId]);

  const discoveredTiles = useMemo(
    () => new Set(engine.state.discoveredTiles),
    [engine.state.discoveredTiles],
  );
  const revealedEntities = useMemo(
    () => new Set(engine.state.revealedEntities),
    [engine.state.revealedEntities],
  );

  const entityPositions = engine.state.entityPositions;
  const heroTokens = engine.state.heroTokens;
  const movementTrail = engine.state.movementTrail;

  const handleRevealArea = () => {
    if (!selectedTile) return;
    const region = getVisibleRegionAt(selectedTile, { radius: 2 });
    engine.revealTiles(region);
    if (iconLogic.length > 0) {
      engine.applyLogicTrigger({ type: "onReveal", tiles: region });
    } else {
      const entities = findEntitiesInRegion(items, region);
      entities.forEach((entityId) => engine.revealEntity(entityId));
    }
  };

  const handleSearch = () => {
    if (!selectedTile) return;
    const region = getSearchRegion(selectedTile, SEARCH_RADIUS);
    engine.revealTiles(region);
    if (iconLogic.length > 0) {
      engine.applyLogicTrigger({ type: "onSearch", tiles: region });
      engine.applyLogicTrigger({ type: "onReveal", tiles: region });
    } else {
      const entities = findEntitiesInRegion(items, region);
      entities.forEach((entityId) => engine.revealEntity(entityId));
    }
  };

  const heroById = useMemo(() => {
    const map = new Map<string, { id: string; assetId: string; name: string; x: number; y: number }>();
    heroTokens.forEach((hero) => map.set(hero.id, hero));
    return map;
  }, [heroTokens]);

  const itemById = useMemo(() => {
    const map = new Map<string, QuestItem>();
    items.forEach((item) => map.set(item.id, item));
    return map;
  }, [items]);

  const doorItems = useMemo(() => {
    return items
      .map((item) => {
        const asset = assetsById.get(item.assetId);
        if (!isDoorItem(item, asset)) return null;
        return {
          id: item.id,
          x: item.x,
          y: item.y,
          offsetX: item.offsetX ?? 0,
          offsetY: item.offsetY ?? 0,
          isSecret: isSecretDoor(item, asset),
        } satisfies DoorInfo;
      })
      .filter(Boolean) as DoorInfo[];
  }, [assetsById, items]);

  const walkableEntityIds = useMemo(() => {
    const ids = new Set<string>();
    items.forEach((item) => {
      const asset = assetsById.get(item.assetId);
      if (item.layer === "tile") {
        ids.add(item.id);
        return;
      }
      if (asset?.category === "marking" || item.assetId.toLowerCase().startsWith("mark-")) {
        ids.add(item.id);
        return;
      }
      if (isDoorItem(item, asset)) {
        ids.add(item.id);
      }
    });
    return ids;
  }, [assetsById, items]);

  const movableEntityIds = useMemo(() => {
    const ids = new Set<string>();
    heroTokens.forEach((hero) => ids.add(hero.id));
    if (sessionPhase === "active") {
      items.forEach((item) => {
        if (item.layer === "monster") ids.add(item.id);
      });
    }
    return ids;
  }, [heroTokens, items, sessionPhase]);

  const getEntityPosition = (entityId: string): TileCoord | null => {
    const hero = heroById.get(entityId);
    if (hero) return { x: hero.x, y: hero.y };
    const override = entityPositions[entityId];
    if (override) return override;
    const item = itemById.get(entityId);
    if (item) return { x: item.x, y: item.y };
    return null;
  };

  const isEntityMovable = (entityId: string) => {
    if (heroById.has(entityId)) return true;
    const item = itemById.get(entityId);
    return item?.layer === "monster";
  };

  const openDoorIds = engine.state.openDoors;
  const startIconIds = useMemo(
    () =>
      new Set(
        iconLogic
          .filter((entry) => entry.triggerType === "onStart")
          .map((entry) => entry.iconId),
      ),
    [iconLogic],
  );

  const startTiles = useMemo(() => {
    const tiles = items
      .filter((item) => startIconIds.has(item.id))
      .map((item) => ({ id: item.id, x: item.x, y: item.y }));
    return tiles.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  }, [items, startIconIds]);

  const blockedTiles = useMemo(() => {
    const blocked = new Set<string>();
    items.forEach((item) => {
      if (startIconIds.has(item.id)) return;
      const asset = assetsById.get(item.assetId);
      if (isDoorItem(item, asset)) return;
      if (item.layer === "tile") return;
      if (asset?.category === "marking" || item.assetId.toLowerCase().startsWith("mark-")) {
        return;
      }
      const tiles = getItemTiles(item);
      tiles.forEach((tile) => blocked.add(tileKey(tile)));
    });
    return blocked;
  }, [assetsById, items, startIconIds]);

  const occupiedTiles = useMemo(() => {
    const occupied = new Set<string>(blockedTiles);
    heroTokens.forEach((hero) => occupied.add(tileKey({ x: hero.x, y: hero.y })));
    return occupied;
  }, [blockedTiles, heroTokens]);

  const findDoorForEdge = (from: TileCoord, to: TileCoord) => {
    if (from.x === to.x && Math.abs(from.y - to.y) === 1) {
      const y = Math.min(from.y, to.y);
      return doorItems.find(
        (door) => door.offsetY === 0.5 && door.x === from.x && door.y === y,
      );
    }
    if (from.y === to.y && Math.abs(from.x - to.x) === 1) {
      const x = Math.min(from.x, to.x);
      return doorItems.find(
        (door) => door.offsetX === 0.5 && door.x === x && door.y === from.y,
      );
    }
    return undefined;
  };

  const hasWallBetween = (from: TileCoord, to: TileCoord) => {
    const fromCell = boardData[from.y]?.[from.x];
    const toCell = boardData[to.y]?.[to.x];
    if (!fromCell || !toCell) return true;
    if (to.x === from.x + 1) {
      return fromCell.b.includes("r") || toCell.b.includes("l");
    }
    if (to.x === from.x - 1) {
      return fromCell.b.includes("l") || toCell.b.includes("r");
    }
    if (to.y === from.y + 1) {
      return fromCell.b.includes("b") || toCell.b.includes("t");
    }
    if (to.y === from.y - 1) {
      return fromCell.b.includes("t") || toCell.b.includes("b");
    }
    return true;
  };

  const getEnterTriggerTiles = (center: TileCoord, extraOpenDoorIds: string[] = []) => {
    const openDoorSet = new Set<string>([...openDoorIds, ...extraOpenDoorIds]);
    const tiles: TileCoord[] = [center];
    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    for (const dir of directions) {
      const next = { x: center.x + dir.x, y: center.y + dir.y };
      if (next.x < 0 || next.y < 0 || next.x >= 26 || next.y >= 19) continue;
      const wall = hasWallBetween(center, next);
      if (wall) {
        const door = findDoorForEdge(center, next);
        if (!door) continue;
        if (door.isSecret && !openDoorSet.has(door.id)) continue;
        if (!openDoorSet.has(door.id)) continue;
      }
      tiles.push(next);
    }
    return tiles;
  };

  const findOpenTileInRoom = (origin: TileCoord) => {
    const columns = boardData[0]?.length ?? 26;
    const rows = boardData.length ?? 19;
    const queue: TileCoord[] = [origin];
    const visited = new Set<string>([tileKey(origin)]);
    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];

    while (queue.length) {
      const current = queue.shift();
      if (!current) break;
      const currentKey = tileKey(current);
      if (!occupiedTiles.has(currentKey)) {
        return current;
      }

      for (const dir of directions) {
        const next = { x: current.x + dir.x, y: current.y + dir.y };
        if (next.x < 0 || next.y < 0 || next.x >= columns || next.y >= rows) continue;
        const nextKey = tileKey(next);
        if (visited.has(nextKey)) continue;
        if (findDoorForEdge(current, next)) continue;
        if (hasWallBetween(current, next)) continue;
        visited.add(nextKey);
        queue.push(next);
      }
    }
    return null;
  };

  const findFirstOpenTile = () => {
    const columns = boardData[0]?.length ?? 26;
    const rows = boardData.length ?? 19;
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        const key = tileKey({ x, y });
        if (!occupiedTiles.has(key)) return { x, y };
      }
    }
    return null;
  };

  const resolveHeroPlacement = () => {
    if (startTiles.length > 0) {
      const availableStart = startTiles.find(
        (tile) => !occupiedTiles.has(tileKey(tile)),
      );
      if (availableStart) return { x: availableStart.x, y: availableStart.y };
      const fallback = findOpenTileInRoom({ x: startTiles[0].x, y: startTiles[0].y });
      if (fallback) return fallback;
    }
    if (selectedTile && !occupiedTiles.has(tileKey(selectedTile))) return selectedTile;
    return findFirstOpenTile();
  };

  const getReachableRegion = (
    start: TileCoord,
    radius: number,
    extraOpenDoorIds: string[] = [],
  ) => {
    const openDoorSet = new Set<string>([...openDoorIds, ...extraOpenDoorIds]);
    const queue: Array<{ coord: TileCoord; distance: number }> = [
      { coord: start, distance: 0 },
    ];
    const key = (coord: TileCoord) => `${coord.x},${coord.y}`;
    const visited = new Set<string>([key(start)]);
    const result: TileCoord[] = [start];
    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];

    while (queue.length) {
      const current = queue.shift();
      if (!current) break;
      const { coord, distance } = current;
      if (distance >= radius) continue;

      for (const dir of directions) {
        const next: TileCoord = { x: coord.x + dir.x, y: coord.y + dir.y };
        if (next.x < 0 || next.y < 0 || next.x >= 26 || next.y >= 19) continue;
        const nextKey = key(next);
        if (visited.has(nextKey)) continue;
        const wall = hasWallBetween(coord, next);
        if (wall) {
          const door = findDoorForEdge(coord, next);
          if (!door) continue;
          if (door.isSecret && !openDoorSet.has(door.id)) continue;
          if (!openDoorSet.has(door.id)) continue;
        }
        visited.add(nextKey);
        result.push(next);
        queue.push({ coord: next, distance: distance + 1 });
      }
    }
    return result;
  };

  const getSearchRegion = (start: TileCoord, radius: number) =>
    getReachableRegion(start, radius);

  const findPath = (start: TileCoord, goal: TileCoord, maxSteps: number) => {
    const queue: Array<{ coord: TileCoord; distance: number }> = [
      { coord: start, distance: 0 },
    ];
    const key = (coord: TileCoord) => `${coord.x},${coord.y}`;
    const visited = new Set<string>([key(start)]);
    const parent = new Map<string, { prev: string | null; doorId?: string }>();
    parent.set(key(start), { prev: null });

    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];

    while (queue.length) {
      const current = queue.shift();
      if (!current) break;
      const { coord, distance } = current;
      if (coord.x === goal.x && coord.y === goal.y) break;
      if (distance >= maxSteps) continue;

      for (const dir of directions) {
        const next: TileCoord = { x: coord.x + dir.x, y: coord.y + dir.y };
        if (next.x < 0 || next.y < 0 || next.x >= 26 || next.y >= 19) continue;
        const nextKey = key(next);
        if (visited.has(nextKey)) continue;
        const wall = hasWallBetween(coord, next);
        if (wall) {
          const door = findDoorForEdge(coord, next);
          if (!door) continue;
          const isOpen = openDoorIds.includes(door.id);
          if (door.isSecret && !isOpen) continue;
          parent.set(nextKey, { prev: key(coord), doorId: isOpen ? undefined : door.id });
        } else {
          parent.set(nextKey, { prev: key(coord) });
        }
        visited.add(nextKey);
        queue.push({ coord: next, distance: distance + 1 });
      }
    }

    const goalKey = key(goal);
    if (!parent.has(goalKey)) return null;
    const path: TileCoord[] = [];
    const doorsToOpen: string[] = [];
    let cursor: string | null = goalKey;
    while (cursor) {
      const [xRaw, yRaw] = cursor.split(",");
      path.push({ x: Number.parseInt(xRaw, 10), y: Number.parseInt(yRaw, 10) });
      const meta = parent.get(cursor);
      if (meta?.doorId) doorsToOpen.push(meta.doorId);
      cursor = meta?.prev ?? null;
    }
    path.reverse();
    return { path, doorsToOpen };
  };

  const attemptMove = (entityId: string, target: TileCoord) => {
    if (!isEntityMovable(entityId)) return;
    const start = getEntityPosition(entityId);
    if (!start) return;
    const maxSteps = moveRange > 0 ? moveRange : 0;
    const pathResult =
      maxSteps > 0 ? findPath(start, target, maxSteps) : findPath(start, target, 99);
    if (!pathResult) return;
    const { path, doorsToOpen } = pathResult;
    if (path.length === 0) return;
    const trail = path;
    const destination = path[path.length - 1];
    const openedDoorIds: string[] = [];
    doorsToOpen.forEach((doorId) => {
      if (!openDoorIds.includes(doorId)) {
        openedDoorIds.push(doorId);
        engine.openDoor(doorId);
        engine.revealEntity(doorId);
        engine.applyLogicTrigger({ type: "onOpenDoor", entityIds: [doorId] });
        const doorItem = itemById.get(doorId);
        if (doorItem) {
          const revealRegion = getReachableRegion(
            { x: doorItem.x, y: doorItem.y },
            2,
            openedDoorIds,
          );
          engine.revealTiles(revealRegion);
          engine.applyLogicTrigger({ type: "onReveal", tiles: revealRegion });
        }
      }
    });
    engine.moveEntity(entityId, destination, trail);
    if (heroById.has(entityId)) {
      engine.handleEnterTile(
        destination,
        getEnterTriggerTiles(destination, openedDoorIds),
      );
    }
    setSelectedTile(destination);
    setSelectedEntityId(entityId);
  };

  const handleTileClick = (tile: TileCoord) => {
    setSelectedTile(tile);
  };

  const handleSelectEntity = (entityId: string) => {
    setSelectedEntityId(entityId);
    const pos = getEntityPosition(entityId);
    if (pos) setSelectedTile(pos);
  };

  const handleEntityDrop = (entityId: string, tile: TileCoord) => {
    attemptMove(entityId, tile);
  };

  const handleSelectHeroCard = (cardId: string) => {
    setSelectedHeroCardId(cardId);
    const stored = heroIconByCardId[cardId];
    if (stored) {
      setSelectedHeroIconId(stored);
      return;
    }
    const card = heroCardsById.get(cardId);
    if (!card) {
      setSelectedHeroIconId("");
      return;
    }
    setSelectedHeroIconId(resolveHeroIcon(card, heroAssets));
  };

  const handleSelectHeroIcon = (assetId: string) => {
    setSelectedHeroIconId(assetId);
    if (!selectedHeroCardId) return;
    setHeroIconByCardId((prev) => ({ ...prev, [selectedHeroCardId]: assetId }));
  };

  const handlePlaceHero = () => {
    if (!selectedHeroCardId || !selectedHeroIconId) return;
    if (heroTokens.length >= maxHeroes) return;
    const card = heroCardsById.get(selectedHeroCardId);
    const asset = assetsById.get(selectedHeroIconId);
    if (!card || !asset) return;
    const placement = resolveHeroPlacement();
    if (!placement) return;
    engine.addHero({
      id: `hero-${crypto.randomUUID()}`,
      assetId: asset.id,
      name: card.title || card.name || formatIconLabel(asset),
      x: placement.x,
      y: placement.y,
    });
  };

  const handleStartQuest = () => {
    if (heroTokens.length === 0) return;
    setSessionPhase("active");
  };

  const narrativeNotes = useMemo(() => {
    if (!notes.length) return [];
    const noteMap = new Map(notes.map((note) => [note.id, note]));
    return engine.state.narratives
      .map((id) => noteMap.get(id))
      .filter(Boolean) as QuestNote[];
  }, [engine.state.narratives, notes]);

  const objectives = engine.state.objectives;

  return (
    <div
      className={`${styles.sessionShell} ${
        variant === "modal" ? styles.sessionEmbedded : ""
      }`}
    >
      {variant === "page" ? (
        <header className={styles.sessionHeader}>
          <div>
            <p className={styles.sessionKicker}>Play Session</p>
            <h1 className={styles.sessionTitle}>{quest.title || "Untitled Quest"}</h1>
          </div>
          <Link href="/play" className={styles.sessionLink}>
            Back to Quests
          </Link>
        </header>
      ) : null}
      {showResumePrompt ? (
        <div className={styles.sessionPromptOverlay}>
          <div className={styles.sessionPrompt}>
            <div className={styles.sessionPromptTitle}>Resume Quest?</div>
            <div className={styles.sessionPromptText}>
              A saved session was found for this quest.
            </div>
            <div className={styles.sessionPromptActions}>
              <button type="button" onClick={handleContinueSession}>
                Continue Quest
              </button>
              <button type="button" onClick={handleRestartSession}>
                Restart Quest
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <HeroSelectionModal
        isOpen={heroModalOpen}
        heroCards={heroCards}
        heroAssets={heroAssets}
        heroTokens={heroTokens}
        selectedCardId={selectedHeroCardId}
        selectedCard={selectedHeroCard}
        selectedIconId={selectedHeroIconId}
        maxHeroes={maxHeroes}
        onSelectCard={handleSelectHeroCard}
        onSelectIcon={handleSelectHeroIcon}
        onPlaceHero={handlePlaceHero}
        onStartQuest={handleStartQuest}
      />
      <div className={styles.sessionBody}>
        <div className={styles.sessionSidebar}>
          <div className={styles.sessionPanel}>
            <div className={styles.sessionCardsTitle}>Revealed Cards</div>
            {engine.state.revealedCards.length === 0 ? (
              <div className={styles.sessionCardsEmpty}>Nothing revealed yet.</div>
            ) : (
              <ul className={styles.sessionCardsList}>
                {engine.state.revealedCards.map((card) => (
                  <li key={card.id}>
                    <div className={styles.sessionCardName}>{card.title}</div>
                    {card.subtitle ? (
                      <div className={styles.sessionCardMeta}>{card.subtitle}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={styles.sessionPanel}>
            <div className={styles.sessionCardsTitle}>Narrative</div>
            {narrativeNotes.length === 0 ? (
              <div className={styles.sessionCardsEmpty}>No notes revealed yet.</div>
            ) : (
              <ul className={styles.sessionCardsList}>
                {narrativeNotes.map((note) => (
                  <li key={note.id}>
                    <div className={styles.sessionCardName}>Note {note.number}</div>
                    <div className={styles.sessionCardMeta}>{note.text}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={styles.sessionPanel}>
            <div className={styles.sessionCardsTitle}>Objectives</div>
            {objectives.length === 0 ? (
              <div className={styles.sessionCardsEmpty}>No objectives yet.</div>
            ) : (
              <ul className={styles.sessionCardsList}>
                {objectives.map((objectiveId) => (
                  <li key={objectiveId}>
                    <div className={styles.sessionCardName}>{objectiveId}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={styles.sessionPanel}>
            <div className={styles.sessionCardsTitle}>Heroes</div>
            {heroTokens.length === 0 ? (
              <div className={styles.sessionCardsEmpty}>No heroes added yet.</div>
            ) : (
              <ul className={styles.sessionCardsList}>
                {heroTokens.map((hero) => (
                  <li key={hero.id}>
                    <div className={styles.sessionCardName}>{hero.name}</div>
                    <div className={styles.sessionCardMeta}>
                      Tile {hero.x + 1}, {hero.y + 1}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className={styles.sessionMain}>
          <div className={styles.sessionMap}>
            <PlayMap
              board={boardData}
              items={items}
              assetsById={assetsById}
              discoveredTiles={discoveredTiles}
              revealedEntityIds={revealedEntities}
              heroTokens={heroTokens}
              entityPositions={entityPositions}
              movementTrail={movementTrail}
              selectedEntityId={selectedEntityId}
              onSelectEntity={handleSelectEntity}
              onEntityDrop={handleEntityDrop}
              movableEntityIds={movableEntityIds}
              walkableEntityIds={walkableEntityIds}
              hiddenEntityIds={hiddenEntityIds}
              onTileClick={handleTileClick}
              selectedTile={selectedTile}
              onSelectTile={setSelectedTile}
            />
          </div>
          <div className={styles.sessionControls}>
            <div className={styles.sessionButtons}>
              <button type="button" onClick={handleSearch} disabled={controlsDisabled}>
                Search
              </button>
              <button type="button" onClick={handleRevealArea} disabled={controlsDisabled}>
                Reveal Area
              </button>
            </div>
            <div className={styles.sessionControlRow}>
              <button
                type="button"
                onClick={() => {
                  engine.clearMovementTrail();
                }}
                disabled={controlsDisabled}
              >
                End Turn
              </button>
              <label className={styles.sessionControlLabel}>
                Move Range
                <input
                  type="number"
                  min={0}
                  className={styles.sessionInput}
                  value={moveRange}
                  onChange={(event) => {
                    const value = Number.parseInt(event.target.value, 10);
                    setMoveRange(Number.isFinite(value) ? value : 0);
                  }}
                  disabled={controlsDisabled}
                />
              </label>
            </div>
            {selectedEntityId ? (
              <div className={styles.sessionHint}>
                Selected:{" "}
                {heroById.get(selectedEntityId)?.name ??
                  entityInfoById.get(selectedEntityId)?.title ??
                  selectedEntityId}{" "}
                {isEntityMovable(selectedEntityId) ? "" : "(not movable)"}
              </div>
            ) : (
              <div className={styles.sessionHint}>Select a unit to move it.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
