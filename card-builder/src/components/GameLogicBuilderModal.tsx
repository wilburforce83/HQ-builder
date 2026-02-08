"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import ModalShell from "@/components/ModalShell";
import boardData from "@/data/boardData";
import { spanForRotation } from "@/lib/play-session-engine";
import type { Action, Condition, IconLogic, IconTarget, QuestNote } from "@/types/quest";
import styles from "./GameLogicBuilderModal.module.css";

type CardSummary = {
  id: string;
  name?: string | null;
  title?: string | null;
};

type GameLogicBuilderModalProps = {
  isOpen: boolean;
  onClose: () => void;
  iconTargets: IconTarget[];
  notes: QuestNote[];
  initialLogic?: IconLogic[] | null;
  onSave: (logic: IconLogic[]) => void;
};

const TRIGGER_OPTIONS = [
  "onStart",
  "onEnterTile",
  "onReveal",
  "onOpenDoor",
  "onSearch",
  "custom",
] as const;

const CONDITION_OPTIONS = [
  "flagSet",
  "flagUnset",
  "flagExists",
  "noteExists",
  "custom",
] as const;

const ACTION_OPTIONS = [
  "revealTiles",
  "revealRadius",
  "revealEntities",
  "addNarrative",
  "revealCard",
  "setFlag",
  "clearFlag",
  "addObjective",
] as const;

const columns = boardData[0]?.length ?? 26;
const rows = boardData.length ?? 19;

function getIconRenderScale(paddingPct?: number | null) {
  const padding =
    typeof paddingPct === "number" && Number.isFinite(paddingPct)
      ? Math.min(Math.max(paddingPct, 0), 100)
      : 0;
  const base = 1 - padding / 100;
  return {
    scaleX: base,
    scaleY: base,
  };
}

function getTargetSpan(target: IconTarget) {
  if (
    typeof target.spanW === "number" &&
    Number.isFinite(target.spanW) &&
    typeof target.spanH === "number" &&
    Number.isFinite(target.spanH)
  ) {
    return { w: target.spanW, h: target.spanH };
  }
  if (
    typeof target.baseW === "number" &&
    Number.isFinite(target.baseW) &&
    typeof target.baseH === "number" &&
    Number.isFinite(target.baseH)
  ) {
    return spanForRotation(target.baseW, target.baseH, target.rotation ?? 0);
  }
  return { w: 1, h: 1 };
}

function getTargetScale(target: IconTarget) {
  const baseRatio =
    typeof target.baseW === "number" && typeof target.baseH === "number" && target.baseH !== 0
      ? target.baseW / target.baseH
      : 1;
  const rotation = target.rotation ?? 0;
  const rotateScale =
    rotation % 180 === 0 ? 1 : Math.max(baseRatio, baseRatio !== 0 ? 1 / baseRatio : 1);
  const iconScale = getIconRenderScale(target.paddingPct ?? null);
  return {
    scaleX: rotateScale * iconScale.scaleX,
    scaleY: rotateScale * iconScale.scaleY,
  };
}

function createLogicId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDefaultLogic(iconId: string, id: string = createLogicId()): IconLogic {
  return {
    id,
    iconId,
    triggerType: "onEnterTile",
    conditionsMode: "all",
    conditions: [],
    actions: [],
  };
}

function createDefaultCondition(): Condition {
  return { type: "flagSet", operand: "" };
}

function createDefaultAction(): Action {
  return { type: "revealTiles", payload: { coords: [] } };
}

function coordsToText(coords: Array<{ x: number; y: number }>) {
  return coords.map((coord) => `${coord.x},${coord.y}`).join("; ");
}

function parseCoords(text: string): Array<{ x: number; y: number }> {
  if (!text.trim()) return [];
  return text
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [xRaw, yRaw] = pair.split(",").map((part) => part.trim());
      const x = Number.parseInt(xRaw ?? "", 10);
      const y = Number.parseInt(yRaw ?? "", 10);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { x, y };
    })
    .filter(Boolean) as Array<{ x: number; y: number }>;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function coordsFromRect(start: { x: number; y: number }, end: { x: number; y: number }) {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);
  const coords: Array<{ x: number; y: number }> = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      coords.push({ x, y });
    }
  }
  return coords;
}

function normalizeLogic(logic: IconLogic[]): IconLogic[] {
  return logic.map((entry) => ({
    ...entry,
    id: entry.id ?? createLogicId(),
    triggerType: entry.triggerType || "onEnterTile",
    conditionsMode: entry.conditionsMode ?? "all",
    conditions: Array.isArray(entry.conditions) ? entry.conditions : [],
    actions: Array.isArray(entry.actions) ? entry.actions : [],
  }));
}

function useValidation(
  logic: IconLogic[],
  notes: QuestNote[],
  cards: CardSummary[],
  iconTargets: IconTarget[],
) {
  return useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const noteIds = new Set(notes.map((note) => note.id));
    const cardIds = new Set(cards.map((card) => card.id));
    const iconMap = new Map(iconTargets.map((target) => [target.id, target]));
    const overlapBuckets = new Map<string, Set<string>>();

    for (const entry of logic) {
      const icon = iconMap.get(entry.iconId);
      if (!icon) {
        warnings.push(
          `Logic trigger ${entry.triggerType} attached to a missing icon (${entry.iconId}).`,
        );
      } else {
        const key = `${icon.x},${icon.y}`;
        const bucket = overlapBuckets.get(key) ?? new Set<string>();
        bucket.add(icon.id);
        overlapBuckets.set(key, bucket);
      }

      if (!entry.actions || entry.actions.length === 0) {
        errors.push(`Icon ${entry.iconId} (${entry.triggerType}) needs at least one action.`);
      }

      for (const condition of entry.conditions ?? []) {
        if (condition.type === "noteExists" && condition.operand && !noteIds.has(condition.operand)) {
          errors.push(`Condition references a missing note (${condition.operand}).`);
        }
      }

      for (const action of entry.actions ?? []) {
        if (action.type === "addNarrative") {
          const noteIdsPayload = Array.isArray(action.payload?.noteIds) ? action.payload.noteIds : [];
          if (noteIdsPayload.length === 0) {
            errors.push("Narrative actions must reference at least one note.");
          }
          for (const id of noteIdsPayload) {
            if (!noteIds.has(id)) {
              errors.push(`Narrative action references a missing note (${id}).`);
            }
          }
        }
        if (action.type === "revealEntities") {
          const entityIdsPayload = Array.isArray(action.payload?.entityIds)
            ? action.payload.entityIds
            : [];
          if (entityIdsPayload.length === 0) {
            errors.push("Reveal entity actions must reference at least one map item.");
          }
          for (const id of entityIdsPayload) {
            if (!iconMap.has(id)) {
              warnings.push(`Reveal entity action references a missing map item (${id}).`);
            }
          }
        }
        if (action.type === "revealRadius") {
          const radiusRaw = action.payload?.radius;
          const radius = Number.isFinite(radiusRaw)
            ? Number(radiusRaw)
            : Number.parseFloat(String(radiusRaw ?? ""));
          if (!Number.isFinite(radius) || radius <= 0) {
            errors.push("Reveal radius actions need a positive radius.");
          }
        }
        if (action.type === "revealCard") {
          const cardIdsPayload = Array.isArray(action.payload?.cardIds) ? action.payload.cardIds : [];
          if (cardIdsPayload.length === 0) {
            errors.push("Reveal card actions must reference at least one card.");
          }
          for (const id of cardIdsPayload) {
            if (!cardIds.has(id)) {
              errors.push(`Reveal card action references a missing card (${id}).`);
            }
          }
        }
      }
    }

    for (const [coords, ids] of overlapBuckets) {
      if (ids.size > 1) {
        const labels = Array.from(ids)
          .map((id) => iconMap.get(id)?.label ?? id)
          .join(", ");
        warnings.push(`Multiple logic triggers share tile ${coords}: ${labels}.`);
      }
    }

    return { errors, warnings };
  }, [logic, notes, cards, iconTargets]);
}

type MultiSelectOption = {
  id: string;
  label: string;
};

type MultiSelectPickerProps = {
  label: string;
  options: MultiSelectOption[];
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
  placeholder?: string;
  emptyLabel?: string;
};

function MultiSelectPicker({
  label,
  options,
  selectedIds,
  onChange,
  placeholder,
  emptyLabel,
}: MultiSelectPickerProps) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => option.label.toLowerCase().includes(normalized));
  }, [options, query]);

  const addId = (id: string) => {
    if (selectedIds.includes(id)) return;
    onChange([...selectedIds, id]);
  };

  const removeId = (id: string) => {
    onChange(selectedIds.filter((entry) => entry !== id));
  };

  return (
    <div className={styles.multiSelect}>
      <div className={styles.multiSelectHeader}>{label}</div>
      <input
        type="search"
        className={styles.textInput}
        placeholder={placeholder ?? "Search..."}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className={styles.multiSelectList}>
        {filtered.length === 0 ? (
          <div className={styles.emptyHint}>{emptyLabel ?? "No matches"}</div>
        ) : (
          filtered.slice(0, 8).map((option) => (
            <button
              key={option.id}
              type="button"
              className={styles.optionButton}
              onClick={() => addId(option.id)}
              disabled={selectedIds.includes(option.id)}
            >
              {option.label}
            </button>
          ))
        )}
      </div>
      {selectedIds.length > 0 ? (
        <div className={styles.selectedChips}>
          {selectedIds.map((id) => {
            const option = options.find((entry) => entry.id === id);
            const labelText = option?.label ?? id;
            return (
              <div key={id} className={styles.chip}>
                <span>{labelText}</span>
                <button type="button" onClick={() => removeId(id)} aria-label={`Remove ${labelText}`}>
                  ×
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function GameLogicBuilderModal({
  isOpen,
  onClose,
  iconTargets,
  notes,
  initialLogic,
  onSave,
}: GameLogicBuilderModalProps) {
  const [draftLogic, setDraftLogic] = useState<IconLogic[]>([]);
  const [selectedIconId, setSelectedIconId] = useState<string | null>(null);
  const [selectedLogicId, setSelectedLogicId] = useState<string | null>(null);
  const [cards, setCards] = useState<CardSummary[]>([]);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapWrapperRef = useRef<HTMLDivElement | null>(null);
  const mapBaseRef = useRef<HTMLDivElement | null>(null);
  const [activeRevealActionIndex, setActiveRevealActionIndex] = useState<number | null>(null);
  const [focusedRevealActionIndex, setFocusedRevealActionIndex] = useState<number | null>(null);
  const [dragSelection, setDragSelection] = useState<{
    start: { x: number; y: number };
    end: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const normalized = normalizeLogic(initialLogic ?? []);
    setDraftLogic(normalized);
    setSelectedIconId((prev) => {
      const next =
        prev && iconTargets.some((target) => target.id === prev)
          ? prev
          : iconTargets[0]?.id ?? null;
      if (!next) {
        setSelectedLogicId(null);
        return next;
      }
      const firstLogic = normalized.find((entry) => entry.iconId === next);
      setSelectedLogicId(firstLogic?.id ?? null);
      return next;
    });
  }, [isOpen, initialLogic, iconTargets]);

  useEffect(() => {
    if (!isOpen) return;
    const wrapper = mapWrapperRef.current;
    const base = mapBaseRef.current;
    if (!wrapper || !base) return;

    const updateCellSize = () => {
      const available = wrapper.clientWidth;
      if (!available) return;
      const borderRaw = getComputedStyle(base).getPropertyValue("--map-border").trim();
      const border = Number.parseFloat(borderRaw) || 0;
      const maxCell = 24;
      const minCell = 14;
      const computed = Math.floor((available - border * 2) / columns);
      const cellSize = Math.max(minCell, Math.min(maxCell, computed));
      base.style.setProperty("--cell-size", `${cellSize}px`);
    };

    updateCellSize();
    const observer = new ResizeObserver(updateCellSize);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveRevealActionIndex(null);
    setFocusedRevealActionIndex(null);
    setDragSelection(null);
  }, [isOpen, selectedIconId, selectedLogicId]);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

  const validation = useValidation(draftLogic, notes, cards, iconTargets);

  const iconMap = useMemo(() => {
    return new Map(iconTargets.map((target) => [target.id, target]));
  }, [iconTargets]);
  const logicCountByIconId = useMemo(() => {
    const counts = new Map<string, number>();
    draftLogic.forEach((entry) => {
      counts.set(entry.iconId, (counts.get(entry.iconId) ?? 0) + 1);
    });
    return counts;
  }, [draftLogic]);

  const selectedIcon = selectedIconId ? iconMap.get(selectedIconId) : undefined;
  const logicEntriesForSelectedIcon = useMemo(
    () => (selectedIconId ? draftLogic.filter((entry) => entry.iconId === selectedIconId) : []),
    [draftLogic, selectedIconId],
  );
  const selectedLogic = selectedLogicId
    ? draftLogic.find((entry) => entry.id === selectedLogicId)
    : logicEntriesForSelectedIcon[0];

  useEffect(() => {
    if (!selectedIconId) {
      setSelectedLogicId(null);
      return;
    }
    if (logicEntriesForSelectedIcon.length === 0) {
      setSelectedLogicId(null);
      return;
    }
    if (selectedLogicId && logicEntriesForSelectedIcon.some((entry) => entry.id === selectedLogicId)) {
      return;
    }
    setSelectedLogicId(logicEntriesForSelectedIcon[0]?.id ?? null);
  }, [logicEntriesForSelectedIcon, selectedIconId, selectedLogicId]);

  useEffect(() => {
    if (!selectedLogic) {
      setActiveRevealActionIndex(null);
      setFocusedRevealActionIndex(null);
      setDragSelection(null);
      return;
    }
    const maxIndex = selectedLogic.actions.length - 1;
    if (activeRevealActionIndex != null && activeRevealActionIndex > maxIndex) {
      setActiveRevealActionIndex(null);
      setDragSelection(null);
    }
    if (focusedRevealActionIndex != null && focusedRevealActionIndex > maxIndex) {
      setFocusedRevealActionIndex(null);
    }
  }, [selectedLogic, activeRevealActionIndex, focusedRevealActionIndex]);

  const orphanedLogic = useMemo(
    () => draftLogic.filter((entry) => !iconMap.has(entry.iconId)),
    [draftLogic, iconMap],
  );

  const numberedNotes = useMemo(() => notes.filter((note) => note.number > 1), [notes]);

  const noteOptions = useMemo<MultiSelectOption[]>(() => {
    return numberedNotes.map((note) => ({
      id: note.id,
      label: `Note ${note.number}: ${note.text.slice(0, 40)}`.trim(),
    }));
  }, [numberedNotes]);

  const cardOptions = useMemo<MultiSelectOption[]>(() => {
    return cards.map((card) => ({
      id: card.id,
      label: card.title || card.name || "Untitled Card",
    }));
  }, [cards]);

  const entityOptions = useMemo<MultiSelectOption[]>(
    () =>
      iconTargets.map((target) => ({
        id: target.id,
        label: `${target.label} (Tile ${target.x + 1}, ${target.y + 1})`,
      })),
    [iconTargets],
  );

  const updateSelectedLogic = (updater: (entry: IconLogic) => IconLogic) => {
    if (!selectedLogicId) return;
    setDraftLogic((prev) =>
      prev.map((entry) => (entry.id === selectedLogicId ? updater(entry) : entry)),
    );
  };

  const handleSelectIcon = (iconId: string) => {
    const existing = draftLogic.filter((entry) => entry.iconId === iconId);
    if (existing.length > 0) {
      setSelectedIconId(iconId);
      setSelectedLogicId(existing[0]?.id ?? null);
      return;
    }
    const newLogic = createDefaultLogic(iconId);
    setDraftLogic((prev) => [...prev, newLogic]);
    setSelectedIconId(iconId);
    setSelectedLogicId(newLogic.id ?? null);
  };

  const handleAddTrigger = () => {
    if (!selectedIconId) return;
    const newLogic = createDefaultLogic(selectedIconId);
    setDraftLogic((prev) => [...prev, newLogic]);
    setSelectedLogicId(newLogic.id ?? null);
  };

  const handleRemoveLogic = (logicId: string | null) => {
    if (!logicId) return;
    setDraftLogic((prev) => prev.filter((entry) => entry.id !== logicId));
    setSelectedLogicId((prev) => (prev === logicId ? null : prev));
  };

  const getCoordFromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!mapRef.current) return null;
    const rect = mapRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const cellW = rect.width / columns;
    const cellH = rect.height / rows;
    const rawX = (event.clientX - rect.left) / cellW;
    const rawY = (event.clientY - rect.top) / cellH;
    const x = clamp(Math.floor(rawX), 0, columns - 1);
    const y = clamp(Math.floor(rawY), 0, rows - 1);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  };

  const handleMapPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activeRevealActionIndex == null) return;
    const coord = getCoordFromPointer(event);
    if (!coord) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragSelection({ start: coord, end: coord });
  };

  const handleMapPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activeRevealActionIndex == null) return;
    if (!dragSelection) return;
    const coord = getCoordFromPointer(event);
    if (!coord) return;
    setDragSelection((prev) => (prev ? { ...prev, end: coord } : prev));
  };

  const finalizeSelection = () => {
    if (activeRevealActionIndex == null || !dragSelection) return;
    const coords = coordsFromRect(dragSelection.start, dragSelection.end);
    updateSelectedLogic((entry) => ({
      ...entry,
      actions: entry.actions.map((item, idx) =>
        idx === activeRevealActionIndex ? { ...item, payload: { coords } } : item,
      ),
    }));
    setDragSelection(null);
    setActiveRevealActionIndex(null);
  };

  const handleMapPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activeRevealActionIndex == null) return;
    event.preventDefault();
    finalizeSelection();
  };

  const handleMapPointerLeave = () => {
    if (activeRevealActionIndex == null) return;
    finalizeSelection();
  };

  const activeCoords = useMemo(() => {
    if (!selectedLogic) return [];
    const index = activeRevealActionIndex ?? focusedRevealActionIndex;
    if (index == null) return [];
    const action = selectedLogic.actions[index];
    if (!action || action.type !== "revealTiles") return [];
    return Array.isArray(action.payload?.coords) ? action.payload.coords : [];
  }, [selectedLogic, activeRevealActionIndex, focusedRevealActionIndex]);

  const dragCoords = useMemo(() => {
    if (!dragSelection) return [];
    return coordsFromRect(dragSelection.start, dragSelection.end);
  }, [dragSelection]);

  const canSave = validation.errors.length === 0;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Game Logic Builder"
      contentClassName={styles.gameLogicModal}
      footer={
        <div className={styles.modalFooter}>
          <div className={styles.validationSummary}>
            {validation.errors.length > 0 ? (
              <div className={styles.validationError}>
                {validation.errors.map((error) => (
                  <div key={error}>{error}</div>
                ))}
              </div>
            ) : null}
            {validation.warnings.length > 0 ? (
              <div className={styles.validationWarning}>
                {validation.warnings.map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
              </div>
            ) : null}
          </div>
          <div className={styles.footerActions}>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                if (!canSave) return;
                onSave(draftLogic);
              }}
              disabled={!canSave}
            >
              Save Logic
            </button>
          </div>
        </div>
      }
    >
      <div className={styles.modalBody}>
        <div className={styles.iconColumn} data-testid="icon-list">
          <div className={styles.columnTitle}>Map Icons</div>
          {iconTargets.length === 0 ? (
            <div className={styles.emptyHint}>Place numbered icons on the map to attach logic.</div>
          ) : (
            iconTargets.map((target) => (
              <button
                key={target.id}
                type="button"
                className={`${styles.iconItem} ${
                  selectedIconId === target.id ? styles.iconItemActive : ""
                }`}
                onClick={() => handleSelectIcon(target.id)}
              >
                <div className={styles.iconPreview}>
                  {target.url ? <img src={target.url} alt={target.label} /> : null}
                  {target.numberLabel ? <span>{target.numberLabel}</span> : null}
                </div>
                <div className={styles.iconMeta}>
                  <div className={styles.iconLabel}>{target.label}</div>
                  <div className={styles.iconCoords}>
                    Tile {target.x + 1}, {target.y + 1}
                  </div>
                  {(logicCountByIconId.get(target.id) ?? 0) > 1 ? (
                    <div className={styles.iconCount}>
                      {logicCountByIconId.get(target.id)} triggers
                    </div>
                  ) : null}
                </div>
              </button>
            ))
          )}
          {orphanedLogic.length > 0 ? (
            <div className={styles.orphanedSection}>
              <div className={styles.columnTitle}>Missing Icons</div>
              {orphanedLogic.map((entry) => (
                <div key={entry.id ?? entry.iconId} className={styles.orphanedItem}>
                  <span>
                    Missing icon {entry.iconId} ({entry.triggerType})
                  </span>
                  <button type="button" onClick={() => handleRemoveLogic(entry.id ?? null)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className={styles.editorColumn}>
          <div className={styles.mapPanel}>
            <div className={styles.mapHeader}>
              <div className={styles.columnTitle}>Dungeon Map</div>
              {activeRevealActionIndex != null ? (
                <div className={styles.mapHint}>Drag to select tiles for the active action.</div>
              ) : (
                <div className={styles.mapHint}>Click an icon to load its logic.</div>
              )}
            </div>
            <div
              ref={mapWrapperRef}
              className={`${styles.mapWrapper} ${
                activeRevealActionIndex != null ? styles.mapSelecting : ""
              }`}
            >
              <div ref={mapBaseRef} className={styles.mapBase}>
                <div
                  className={styles.mapGridBase}
                  style={{
                    gridTemplateColumns: `repeat(${columns}, var(--cell-size))`,
                    gridTemplateRows: `repeat(${rows}, var(--cell-size))`,
                  }}
                >
                  {boardData.map((row, rowIndex) =>
                    row.map((cell, colIndex) => {
                      const classes = [styles.mapCell];
                      if (cell.t === "corridor") classes.push(styles.mapCorridor);
                      if (cell.b.includes("l")) classes.push(styles.mapBorderLeft);
                      if (cell.b.includes("r")) classes.push(styles.mapBorderRight);
                      if (cell.b.includes("t")) classes.push(styles.mapBorderTop);
                      if (cell.b.includes("b")) classes.push(styles.mapBorderBottom);
                      return (
                        <div key={`${rowIndex}-${colIndex}`} className={classes.join(" ")} />
                      );
                    }),
                  )}
                </div>
                <div
                  ref={mapRef}
                  className={styles.mapGridOverlay}
                  style={{
                    gridTemplateColumns: `repeat(${columns}, var(--cell-size))`,
                    gridTemplateRows: `repeat(${rows}, var(--cell-size))`,
                  }}
                  onPointerDown={handleMapPointerDown}
                  onPointerMove={handleMapPointerMove}
                  onPointerUp={handleMapPointerUp}
                  onPointerLeave={handleMapPointerLeave}
                >
                  {activeCoords.map((coord) => (
                    <div
                      key={`active-${coord.x}-${coord.y}`}
                      className={styles.mapSelection}
                      style={{ gridColumn: coord.x + 1, gridRow: coord.y + 1 }}
                    />
                  ))}
                  {dragCoords.map((coord) => (
                    <div
                      key={`drag-${coord.x}-${coord.y}`}
                      className={styles.mapSelectionPreview}
                      style={{ gridColumn: coord.x + 1, gridRow: coord.y + 1 }}
                    />
                  ))}
                  {iconTargets.map((target) => {
                    const span = getTargetSpan(target);
                    const offsetX = target.offsetX ?? 0;
                    const offsetY = target.offsetY ?? 0;
                    const { scaleX, scaleY } = getTargetScale(target);
                    const style: CSSProperties = {
                      gridColumn: `${target.x + 1} / span ${span.w}`,
                      gridRow: `${target.y + 1} / span ${span.h}`,
                      transform: `translate(${offsetX * 100}%, ${offsetY * 100}%)`,
                      zIndex:
                        target.layer === "monster" ? 3 : target.layer === "furniture" ? 2 : 1,
                    };
                    return (
                      <button
                        key={target.id}
                        type="button"
                        className={`${styles.mapIcon} ${
                          selectedIconId === target.id ? styles.mapIconActive : ""
                        }`}
                        style={style}
                        onClick={() => handleSelectIcon(target.id)}
                        aria-label={`Map icon ${target.label}`}
                      >
                        {target.url ? (
                          <img
                            src={target.url}
                            alt=""
                            style={{
                              transform: `rotate(${target.rotation ?? 0}deg) scale(${scaleX}, ${scaleY})`,
                            }}
                          />
                        ) : null}
                        {target.numberLabel ? <span>{target.numberLabel}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          {!selectedIconId ? (
            <div className={styles.emptyState}>Select a map icon to configure its logic.</div>
          ) : !selectedLogic ? (
            <div className={styles.emptyState}>
              <div>No triggers yet for this icon.</div>
              <button type="button" className={styles.secondaryButton} onClick={handleAddTrigger}>
                Add Trigger
              </button>
            </div>
          ) : (
            <>
              <div className={styles.editorHeader}>
                <div>
                  <div className={styles.editorTitle}>{selectedIcon?.label ?? "Icon"}</div>
                  {selectedIcon ? (
                    <div className={styles.editorSubtitle}>
                      Tile {selectedIcon.x + 1}, {selectedIcon.y + 1}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => handleRemoveLogic(selectedLogic.id ?? null)}
                >
                  Remove Trigger
                </button>
              </div>

              <div className={styles.triggerTabs}>
                {logicEntriesForSelectedIcon.map((entry, index) => (
                  <button
                    key={entry.id ?? `${entry.iconId}-${index}`}
                    type="button"
                    className={`${styles.triggerTab} ${
                      selectedLogic?.id === entry.id ? styles.triggerTabActive : ""
                    }`}
                    onClick={() => setSelectedLogicId(entry.id ?? null)}
                  >
                    {entry.triggerType}
                  </button>
                ))}
                <button
                  type="button"
                  className={styles.triggerAdd}
                  onClick={handleAddTrigger}
                >
                  + Add Trigger
                </button>
              </div>

              <div className={styles.section}>
                <div className={styles.sectionTitle}>Trigger</div>
                <div className={styles.fieldRow}>
                  <label htmlFor="triggerType">Trigger Type</label>
                  <select
                    id="triggerType"
                    className={styles.selectInput}
                    value={
                      TRIGGER_OPTIONS.includes(selectedLogic.triggerType as (typeof TRIGGER_OPTIONS)[number])
                        ? selectedLogic.triggerType
                        : "custom"
                    }
                    onChange={(event) => {
                      const value = event.target.value;
                      updateSelectedLogic((entry) => ({
                        ...entry,
                        triggerType: value === "custom" ? "custom" : value,
                      }));
                    }}
                  >
                    {TRIGGER_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedLogic.triggerType === "custom" ||
                !TRIGGER_OPTIONS.includes(selectedLogic.triggerType as (typeof TRIGGER_OPTIONS)[number]) ? (
                  <div className={styles.fieldRow}>
                    <label htmlFor="customTrigger">Custom Trigger</label>
                    <input
                      id="customTrigger"
                      className={styles.textInput}
                      placeholder="e.g. onActivate"
                      value={
                        selectedLogic.triggerType === "custom" ? "" : selectedLogic.triggerType
                      }
                      onChange={(event) => {
                        const value = event.target.value.trim();
                        updateSelectedLogic((entry) => ({
                          ...entry,
                          triggerType: value || "custom",
                        }));
                      }}
                    />
                  </div>
                ) : null}
              </div>

              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitle}>Conditions</div>
                  <div className={styles.inlineControls}>
                    <select
                      className={styles.selectInput}
                      aria-label="Conditions logic"
                      value={selectedLogic.conditionsMode ?? "all"}
                      onChange={(event) =>
                        updateSelectedLogic((entry) => ({
                          ...entry,
                          conditionsMode: event.target.value as "all" | "any",
                        }))
                      }
                    >
                      <option value="all">All conditions (AND)</option>
                      <option value="any">Any condition (OR)</option>
                    </select>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() =>
                        updateSelectedLogic((entry) => ({
                          ...entry,
                          conditions: [...entry.conditions, createDefaultCondition()],
                        }))
                      }
                    >
                      Add Condition
                    </button>
                  </div>
                </div>
                {selectedLogic.conditions.length === 0 ? (
                  <div className={styles.emptyHint}>No conditions yet.</div>
                ) : (
                  <div className={styles.listStack}>
                    {selectedLogic.conditions.map((condition, index) => {
                      const isNoteCondition = condition.type === "noteExists";
                      return (
                        <div key={`${condition.type}-${index}`} className={styles.listRow}>
                          <select
                            className={styles.selectInput}
                            value={condition.type}
                            onChange={(event) => {
                              const value = event.target.value;
                              updateSelectedLogic((entry) => ({
                                ...entry,
                                conditions: entry.conditions.map((item, idx) =>
                                  idx === index
                                    ? {
                                        ...item,
                                        type: value,
                                        operand: "",
                                        comparison: undefined,
                                      }
                                    : item,
                                ),
                              }));
                            }}
                          >
                            {CONDITION_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                          {isNoteCondition ? (
                            <select
                              className={styles.selectInput}
                              value={condition.operand}
                              onChange={(event) => {
                                const value = event.target.value;
                                updateSelectedLogic((entry) => ({
                                  ...entry,
                                  conditions: entry.conditions.map((item, idx) =>
                                    idx === index ? { ...item, operand: value } : item,
                                  ),
                                }));
                              }}
                            >
                              <option value="">Select note</option>
                              {numberedNotes.map((note) => (
                                <option key={note.id} value={note.id}>
                                  Note {note.number}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              className={styles.textInput}
                              placeholder="Operand"
                              value={condition.operand}
                              onChange={(event) => {
                                const value = event.target.value;
                                updateSelectedLogic((entry) => ({
                                  ...entry,
                                  conditions: entry.conditions.map((item, idx) =>
                                    idx === index ? { ...item, operand: value } : item,
                                  ),
                                }));
                              }}
                            />
                          )}
                          <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() =>
                              updateSelectedLogic((entry) => ({
                                ...entry,
                                conditions: entry.conditions.filter((_, idx) => idx !== index),
                              }))
                            }
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitle}>Actions</div>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() =>
                      updateSelectedLogic((entry) => ({
                        ...entry,
                        actions: [...entry.actions, createDefaultAction()],
                      }))
                    }
                  >
                    Add Action
                  </button>
                </div>
                {selectedLogic.actions.length === 0 ? (
                  <div className={styles.emptyHint}>No actions yet.</div>
                ) : (
                  <div className={styles.listStack}>
                    {selectedLogic.actions.map((action, index) => {
                      const payload = action.payload ?? {};
                      return (
                        <div key={`${action.type}-${index}`} className={styles.listRowWide}>
                          <select
                            className={styles.selectInput}
                            value={action.type}
                            onChange={(event) => {
                              const value = event.target.value;
                              if (activeRevealActionIndex === index && value !== "revealTiles") {
                                setActiveRevealActionIndex(null);
                                setFocusedRevealActionIndex(null);
                                setDragSelection(null);
                              }
                              if (value === "revealTiles") {
                                setFocusedRevealActionIndex(index);
                              }
                              updateSelectedLogic((entry) => ({
                                ...entry,
                                actions: entry.actions.map((item, idx) =>
                                  idx === index
                                    ? { ...item, type: value, payload: {} }
                                    : item,
                                ),
                              }));
                            }}
                          >
                            {ACTION_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>

                          {action.type === "revealTiles" ? (
                            <div className={styles.revealTilesEditor}>
                              <input
                                className={styles.textInput}
                                placeholder="x,y; x,y"
                                value={coordsToText(Array.isArray(payload.coords) ? payload.coords : [])}
                                onFocus={() => setFocusedRevealActionIndex(index)}
                                onChange={(event) => {
                                  const coords = parseCoords(event.target.value);
                                  setFocusedRevealActionIndex(index);
                                  updateSelectedLogic((entry) => ({
                                    ...entry,
                                    actions: entry.actions.map((item, idx) =>
                                      idx === index ? { ...item, payload: { coords } } : item,
                                    ),
                                  }));
                                }}
                              />
                              <div className={styles.revealTilesControls}>
                                <button
                                  type="button"
                                  className={styles.secondaryButton}
                                  onClick={() => {
                                    setFocusedRevealActionIndex(index);
                                    if (activeRevealActionIndex === index) {
                                      setActiveRevealActionIndex(null);
                                      setDragSelection(null);
                                    } else {
                                      setActiveRevealActionIndex(index);
                                    }
                                  }}
                                >
                                  {activeRevealActionIndex === index ? "Cancel Selection" : "Select on Map"}
                                </button>
                                <button
                                  type="button"
                                  className={styles.iconButton}
                                  onClick={() => {
                                    setFocusedRevealActionIndex(index);
                                    updateSelectedLogic((entry) => ({
                                      ...entry,
                                      actions: entry.actions.map((item, idx) =>
                                        idx === index ? { ...item, payload: { coords: [] } } : item,
                                      ),
                                    }));
                                  }}
                                >
                                  Clear
                                </button>
                              </div>
                            </div>
                          ) : null}

                          {action.type === "revealRadius" ? (
                            <div className={styles.revealTilesEditor}>
                              <input
                                type="number"
                                min={1}
                                className={styles.textInput}
                                placeholder="Radius (tiles)"
                                value={Number.isFinite(payload.radius) ? payload.radius : ""}
                                onChange={(event) => {
                                  const radiusRaw = Number.parseInt(event.target.value, 10);
                                  const radius = Number.isFinite(radiusRaw) ? radiusRaw : "";
                                  updateSelectedLogic((entry) => ({
                                    ...entry,
                                    actions: entry.actions.map((item, idx) =>
                                      idx === index ? { ...item, payload: { radius } } : item,
                                    ),
                                  }));
                                }}
                              />
                              <div className={styles.emptyHint}>
                                Reveals tiles around this icon when the trigger fires.
                              </div>
                            </div>
                          ) : null}

                          {action.type === "revealEntities" ? (
                            <MultiSelectPicker
                              label="Map Items"
                              options={entityOptions}
                              selectedIds={Array.isArray(payload.entityIds) ? payload.entityIds : []}
                              onChange={(entityIds) =>
                                updateSelectedLogic((entry) => ({
                                  ...entry,
                                  actions: entry.actions.map((item, idx) =>
                                    idx === index ? { ...item, payload: { entityIds } } : item,
                                  ),
                                }))
                              }
                              placeholder="Search map items"
                              emptyLabel="No map items found"
                            />
                          ) : null}

                          {action.type === "addNarrative" ? (
                            <MultiSelectPicker
                              label="Linked Notes"
                              options={noteOptions}
                              selectedIds={Array.isArray(payload.noteIds) ? payload.noteIds : []}
                              onChange={(noteIds) =>
                                updateSelectedLogic((entry) => ({
                                  ...entry,
                                  actions: entry.actions.map((item, idx) =>
                                    idx === index ? { ...item, payload: { noteIds } } : item,
                                  ),
                                }))
                              }
                              placeholder="Search notes"
                              emptyLabel="No notes found"
                            />
                          ) : null}

                          {action.type === "revealCard" ? (
                            <MultiSelectPicker
                              label="Linked Cards"
                              options={cardOptions}
                              selectedIds={Array.isArray(payload.cardIds) ? payload.cardIds : []}
                              onChange={(cardIds) =>
                                updateSelectedLogic((entry) => ({
                                  ...entry,
                                  actions: entry.actions.map((item, idx) =>
                                    idx === index ? { ...item, payload: { cardIds } } : item,
                                  ),
                                }))
                              }
                              placeholder="Search cards"
                              emptyLabel="No cards found"
                            />
                          ) : null}

                          {action.type === "setFlag" || action.type === "clearFlag" ? (
                            <input
                              className={styles.textInput}
                              placeholder="Flag name"
                              value={payload.flag ?? ""}
                              onChange={(event) => {
                                const flag = event.target.value;
                                updateSelectedLogic((entry) => ({
                                  ...entry,
                                  actions: entry.actions.map((item, idx) =>
                                    idx === index ? { ...item, payload: { flag } } : item,
                                  ),
                                }));
                              }}
                            />
                          ) : null}

                          {action.type === "addObjective" ? (
                            <input
                              className={styles.textInput}
                              placeholder="Objective ID"
                              value={payload.objectiveId ?? ""}
                              onChange={(event) => {
                                const objectiveId = event.target.value;
                                updateSelectedLogic((entry) => ({
                                  ...entry,
                                  actions: entry.actions.map((item, idx) =>
                                    idx === index ? { ...item, payload: { objectiveId } } : item,
                                  ),
                                }));
                              }}
                            />
                          ) : null}

                          <button
                            type="button"
                            className={styles.iconButton}
                            onClick={() =>
                              updateSelectedLogic((entry) => ({
                                ...entry,
                                actions: entry.actions.filter((_, idx) => idx !== index),
                              }))
                            }
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
