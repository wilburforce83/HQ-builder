"use client";

import { useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";

import { usePanZoom } from "@/hooks/usePanZoom";
import { getItemSpan, tileKey, type QuestItem, type TileCoord } from "@/lib/play-session-engine";
import { formatIconLabel } from "@/lib/icon-assets";
import styles from "@/app/play.module.css";

type BoardCell = { b: string[]; t: string; r: string };

type AssetLike = {
  id: string;
  name: string;
  iconType?: string | null;
  iconName?: string | null;
};

type PlayMapProps = {
  board: BoardCell[][];
  items: QuestItem[];
  assetsById: Map<string, AssetLike>;
  discoveredTiles: Set<string>;
  revealedEntityIds: Set<string>;
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
  selectedTile,
  onSelectTile,
}: PlayMapProps) {
  const columns = board[0]?.length ?? 0;
  const rows = board.length ?? 0;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  useCellSize(viewportRef, columns, rows);
  const { transformStyle, handlers } = usePanZoom({ minScale: 0.6, maxScale: 3 });

  const revealedItems = useMemo(
    () => items.filter((item) => revealedEntityIds.has(item.id)),
    [items, revealedEntityIds],
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
                    onClick={() => onSelectTile?.({ x: colIndex, y: rowIndex })}
                  >
                    {!discovered ? <span className={styles.mapFog} /> : null}
                  </button>
                );
              }),
            )}
          </div>
          <div className={styles.mapEntities}>
            {revealedItems.map((item) => {
              const asset = assetsById.get(item.assetId);
              const label = asset ? formatIconLabel(asset) : item.assetId;
              const span = getItemSpan(item);
              const offsetX = item.offsetX ?? 0;
              const offsetY = item.offsetY ?? 0;
              const style: CSSProperties = {
                gridColumn: `${item.x + 1} / span ${span.w}`,
                gridRow: `${item.y + 1} / span ${span.h}`,
                transform: `translate(${offsetX * 100}%, ${offsetY * 100}%)`,
                zIndex: item.layer === "monster" ? 3 : item.layer === "furniture" ? 2 : 1,
              };
              return (
                <div key={item.id} style={style} className={styles.mapEntity}>
                  <img
                    src={`/api/assets/${item.assetId}/blob`}
                    alt={label}
                    style={{ transform: `rotate(${item.rotation ?? 0}deg)` }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
