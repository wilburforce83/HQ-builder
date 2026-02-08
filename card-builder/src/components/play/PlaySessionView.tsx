"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import PlayMap from "@/components/play/PlayMap";
import { usePlaySessionEngine } from "@/hooks/usePlaySessionEngine";
import {
  findEntitiesInRegion,
  getVisibleRegionAt,
  type QuestItem,
  type TileCoord,
} from "@/lib/play-session-engine";
import { formatIconLabel } from "@/lib/icon-assets";
import boardData from "@/data/boardData";
import type { IconLogic, QuestNote } from "@/types/quest";
import styles from "@/app/play.module.css";

type AssetLike = {
  id: string;
  name: string;
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

export default function PlaySessionView({
  quest,
  assets,
  storageKey,
  variant = "page",
}: PlaySessionViewProps) {
  const items = quest.data?.items ?? [];
  const iconLogic = Array.isArray(quest.data?.iconLogic) ? quest.data?.iconLogic : [];
  const notes = Array.isArray(quest.notes) ? quest.notes : [];
  const assetsById = useMemo(() => {
    const map = new Map<string, AssetLike>();
    assets.forEach((asset) => map.set(asset.id, asset));
    return map;
  }, [assets]);

  const [cards, setCards] = useState<Array<{ id: string; title?: string | null; name?: string | null }>>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/cards")
      .then((res) => (res.ok ? res.json() : []))
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
    cards.forEach((card) => map.set(card.id, card));
    return map;
  }, [cards]);

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

  const discoveredTiles = useMemo(
    () => new Set(engine.state.discoveredTiles),
    [engine.state.discoveredTiles],
  );
  const revealedEntities = useMemo(
    () => new Set(engine.state.revealedEntities),
    [engine.state.revealedEntities],
  );

  const [selectedTile, setSelectedTile] = useState<TileCoord | null>(null);

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
      <div className={styles.sessionBody}>
        <div className={styles.sessionMap}>
          <PlayMap
            board={boardData}
            items={items}
            assetsById={assetsById}
            discoveredTiles={discoveredTiles}
            revealedEntityIds={revealedEntities}
            selectedTile={selectedTile}
            onSelectTile={setSelectedTile}
          />
        </div>
        <div className={styles.sessionOverlay}>
          <div className={styles.sessionButtons}>
            <button type="button" onClick={() => engine.handleSearchAction(selectedTile)}>
              Search
            </button>
            <button type="button" onClick={() => engine.handleOpenDoor(selectedTile)}>
              Open Door
            </button>
            <button type="button" onClick={() => engine.handleEnterTile(selectedTile)}>
              Enter Tile
            </button>
            <button type="button" onClick={handleRevealArea}>
              Reveal Area
            </button>
          </div>
          <div className={styles.sessionCards}>
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
          <div className={styles.sessionCards}>
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
          <div className={styles.sessionCards}>
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
        </div>
      </div>
    </div>
  );
}
