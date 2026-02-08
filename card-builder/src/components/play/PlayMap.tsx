"use client";

import { useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";

import { usePanZoom } from "@/hooks/usePanZoom";
import {
  getItemSpan,
  getItemTiles,
  tileKey,
  type HeroToken,
  type QuestItem,
  type TileCoord,
} from "@/lib/play-session-engine";
import { formatIconLabel } from "@/lib/icon-assets";
import styles from "@/app/play.module.css";

type BoardCell = { b: string[]; t: string; r: string };

type AssetLike = {
  id: string;
  name: string;
  category?: string | null;
  iconType?: string | null;
  iconName?: string | null;
};

type PlayMapProps = {
  board: BoardCell[][];
  items: QuestItem[];
  assetsById: Map<string, AssetLike>;
  discoveredTiles: Set<string>;
  revealedEntityIds: Set<string>;
  heroTokens?: HeroToken[];
  entityPositions?: Record<string, TileCoord>;
  movementTrail?: TileCoord[];
  selectedEntityId?: string | null;
  onSelectEntity?: (entityId: string) => void;
  onTileClick?: (tile: TileCoord) => void;
  onEntityDrop?: (entityId: string, tile: TileCoord) => void;
  movableEntityIds?: Set<string>;
  walkableEntityIds?: Set<string>;
  hiddenEntityIds?: Set<string>;
  selectedTile?: TileCoord | null;
  onSelectTile?: (tile: TileCoord) => void;
};

function useCellSize(containerRef: React.RefObject<HTMLDivElement>, columns: number, rows: number) {
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const update = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (!width || !height) return;
      const maxCell = 38;
      const minCell = 16;
      const fitW = Math.floor(width / columns);
      const fitH = Math.floor(height / rows);
      const cellSize = Math.max(minCell, Math.min(maxCell, Math.min(fitW, fitH)));
      element.style.setProperty("--cell-size", `${cellSize}px`);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [columns, containerRef, rows]);
}

export default function PlayMap({
  board,
  items,
  assetsById,
  discoveredTiles,
  revealedEntityIds,
  heroTokens = [],
  entityPositions = {},
  movementTrail = [],
  selectedEntityId,
  onSelectEntity,
  onTileClick,
  onEntityDrop,
  movableEntityIds,
  walkableEntityIds,
  hiddenEntityIds,
  selectedTile,
  onSelectTile,
}: PlayMapProps) {
  const columns = board[0]?.length ?? 0;
  const rows = board.length ?? 0;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  useCellSize(viewportRef, columns, rows);
  const { transformStyle, handlers } = usePanZoom({ minScale: 0.6, maxScale: 3 });

  const resolvedItems = useMemo(
    () =>
      items.map((item) => {
        const override = entityPositions[item.id];
        if (!override) return item;
        return { ...item, x: override.x, y: override.y };
      }),
    [entityPositions, items],
  );

  const visibleItems = useMemo(() => {
    return resolvedItems.filter((item) => {
      if (hiddenEntityIds?.has(item.id) && !revealedEntityIds.has(item.id)) {
        return false;
      }
      if (revealedEntityIds.has(item.id)) return true;
      const tiles = getItemTiles(item);
      return tiles.some((tile) => discoveredTiles.has(tileKey(tile)));
    });
  }, [resolvedItems, revealedEntityIds, discoveredTiles, hiddenEntityIds]);

  const heroEntities = useMemo(
    () =>
      heroTokens.map((hero) => ({
        id: hero.id,
        assetId: hero.assetId,
        x: hero.x,
        y: hero.y,
        baseW: 1,
        baseH: 1,
        layer: "monster" as const,
        rotation: hero.rotation ?? 0,
        isHero: true,
        name: hero.name,
      })),
    [heroTokens],
  );

  const renderEntities = useMemo(
    () => [...visibleItems, ...heroEntities],
    [visibleItems, heroEntities],
  );

  return (
    <div className={styles.mapViewport} ref={viewportRef} {...handlers}>
      <div className={styles.mapSurface}>
        <div className={styles.mapInner} style={transformStyle}>
          <div className={styles.mapGrid}>
            {board.map((row, rowIndex) =>
              row.map((cell, colIndex) => {
                const classes = [styles.mapCell];
                if (cell.t === "corridor") classes.push(styles.corridor);
                if (cell.b.includes("l")) classes.push(styles.borderLeft);
                if (cell.b.includes("r")) classes.push(styles.borderRight);
                if (cell.b.includes("t")) classes.push(styles.borderTop);
                if (cell.b.includes("b")) classes.push(styles.borderBottom);
                const isSelected =
                  selectedTile?.x === colIndex && selectedTile?.y === rowIndex;
                if (isSelected) classes.push(styles.mapCellSelected);
                const discovered = discoveredTiles.has(tileKey({ x: colIndex, y: rowIndex }));
                return (
                  <button
                    key={`${rowIndex}-${colIndex}`}
                    type="button"
                    className={classes.join(" ")}
                    onClick={() => {
                      const tile = { x: colIndex, y: rowIndex };
                      onTileClick?.(tile);
                      onSelectTile?.(tile);
                    }}
                    onDragOver={(event) => {
                      if (!onEntityDrop) return;
                      event.preventDefault();
                    }}
                    onDrop={(event) => {
                      if (!onEntityDrop) return;
                      const entityId = event.dataTransfer.getData("text/plain");
                      if (!entityId) return;
                      event.preventDefault();
                      onEntityDrop(entityId, { x: colIndex, y: rowIndex });
                    }}
                  >
                    {!discovered ? <span className={styles.mapFog} /> : null}
                  </button>
                );
              }),
            )}
          </div>
          <div className={styles.mapEntities}>
            {movementTrail.map((coord) => (
              <div
                key={`trail-${coord.x}-${coord.y}`}
                className={styles.mapTrail}
                style={{ gridColumn: coord.x + 1, gridRow: coord.y + 1 }}
              />
            ))}
            {renderEntities.map((item) => {
              const asset = assetsById.get(item.assetId);
              const label = asset ? formatIconLabel(asset) : item.assetId;
              const span = getItemSpan(item);
              const offsetX = item.offsetX ?? 0;
              const offsetY = item.offsetY ?? 0;
              const isDraggable = movableEntityIds ? movableEntityIds.has(item.id) : true;
              const isWalkable = walkableEntityIds ? walkableEntityIds.has(item.id) : false;
              const style: CSSProperties = {
                gridColumn: `${item.x + 1} / span ${span.w}`,
                gridRow: `${item.y + 1} / span ${span.h}`,
                transform: `translate(${offsetX * 100}%, ${offsetY * 100}%)`,
                zIndex: item.layer === "monster" ? 3 : item.layer === "furniture" ? 2 : 1,
              };
              return (
                <button
                  key={item.id}
                  type="button"
                  style={style}
                  className={`${styles.mapEntity} ${
                    selectedEntityId === item.id ? styles.mapEntitySelected : ""
                  }`}
                  draggable={isDraggable}
                  onDragOver={(event) => {
                    if (!onEntityDrop || !isWalkable) return;
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    if (!onEntityDrop || !isWalkable) return;
                    const entityId = event.dataTransfer.getData("text/plain");
                    if (!entityId) return;
                    event.preventDefault();
                    event.stopPropagation();
                    onEntityDrop(entityId, { x: item.x, y: item.y });
                  }}
                  onDragStart={(event) => {
                    if (!isDraggable) {
                      event.preventDefault();
                      return;
                    }
                    event.dataTransfer.setData("text/plain", item.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectEntity?.(item.id);
                  }}
                >
                  <img
                    src={`/api/assets/${item.assetId}/blob`}
                    alt={label}
                    style={{ transform: `rotate(${item.rotation ?? 0}deg)` }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
