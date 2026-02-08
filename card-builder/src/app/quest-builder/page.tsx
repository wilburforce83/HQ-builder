"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileDown, FilePlus, FolderOpen, Images, Save, Settings, Trash2 } from "lucide-react";
import boardData from "@/data/boardData";
import QuestAssetsModal from "@/components/QuestAssetsModal";
import SavedQuestsModal from "@/components/SavedQuestsModal";
import GameLogicBuilderModal from "@/components/GameLogicBuilderModal";
import { formatIconLabel } from "@/lib/icon-assets";
import type { IconLogic, IconTarget, QuestNote } from "@/types/quest";
import styles from "../quest.module.css";

const columns = 26;
const rows = 19;

type Asset = {
  id: string;
  name: string;
  mimeType: string;
  width: number;
  height: number;
  createdAt: number;
  category?: string | null;
  gridW?: number | null;
  gridH?: number | null;
  ratioW?: number | null;
  ratioH?: number | null;
  paddingPct?: number | null;
  iconType?: string | null;
  iconName?: string | null;
};

type PaletteItem = {
  id: string;
  name: string;
  url: string;
  category: string;
  gridW: number;
  gridH: number;
  layer: "tile" | "furniture" | "monster";
  source: "builtin" | "custom";
  isIcon?: boolean;
  paddingPct?: number | null;
};

type PlacedItem = {
  id: string;
  assetId: string;
  source: "builtin" | "custom";
  x: number;
  y: number;
  baseW: number;
  baseH: number;
  spanW?: number;
  spanH?: number;
  rotation: number;
  layer: "tile" | "furniture" | "monster";
  offsetX?: number;
  offsetY?: number;
};

type QuestRecord = {
  id: string;
  title?: string | null;
  campaign?: string | null;
  author?: string | null;
  story?: string | null;
  notes?: QuestNote[] | string | null;
  wanderingMonster?: string | null;
  data?: {
    items: PlacedItem[];
    wandering?: { assetId: string; source: "builtin" | "custom" } | null;
    iconLogic?: IconLogic[] | null;
  } | null;
  createdAt?: number;
  updatedAt?: number;
};

function categoryToLayer(category: string) {
  if (category === "monster" || category === "hero" || category === "icon") return "monster" as const;
  if (category === "furniture") return "furniture" as const;
  return "tile" as const;
}

function iconCategoryForType(iconType?: string | null) {
  const raw = iconType?.trim().toLowerCase();
  if (!raw) return "other";
  if (raw === "monster") return "monster";
  if (raw === "hero") return "hero";
  if (raw === "npc") return "npc";
  return raw;
}

function displayCategoryLabel(category: string) {
  if (category === "monster") return "Monsters";
  if (category === "hero") return "Heroes";
  if (category === "npc") return "NPCs";
  if (category.length === 0) return "Other";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function normalizeGridDimension(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.max(1, Math.round(value));
}

function resolveGridDimension(
  gridValue: number | null | undefined,
  ratioValue: number | null | undefined,
  fallback = 1,
) {
  return normalizeGridDimension(gridValue) ?? normalizeGridDimension(ratioValue) ?? fallback;
}

function getIconRenderScale(item?: {
  paddingPct?: number | null;
}) {
  const padding =
    typeof item?.paddingPct === "number" && Number.isFinite(item.paddingPct)
      ? Math.min(Math.max(item.paddingPct, 0), 100)
      : 0;
  const base = 1 - padding / 100;
  return {
    scaleX: base,
    scaleY: base,
  };
}

function spanForRotation(baseW: number, baseH: number, rotation: number) {
  if (rotation % 180 === 0) {
    return { w: baseW, h: baseH };
  }
  return { w: baseH, h: baseW };
}

function getSpan(item: PlacedItem) {
  if (item.spanW && item.spanH) {
    return { w: item.spanW, h: item.spanH };
  }
  return spanForRotation(item.baseW, item.baseH, item.rotation);
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function autoSizeTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function createQuestNote(number: number, text = "", overrides?: Partial<QuestNote>): QuestNote {
  return {
    id: overrides?.id ?? crypto.randomUUID(),
    number,
    text,
    linkedTriggers: overrides?.linkedTriggers,
    linkedEntities: overrides?.linkedEntities,
  };
}

function normalizeQuestNotes(raw: QuestRecord["notes"]): QuestNote[] {
  if (Array.isArray(raw)) {
    const normalized = raw.map((note, index) =>
      createQuestNote(
        typeof note?.number === "number" && Number.isFinite(note.number) ? note.number : index + 1,
        typeof note?.text === "string" ? note.text : "",
        {
          id: typeof note?.id === "string" ? note.id : undefined,
          linkedTriggers: Array.isArray(note?.linkedTriggers) ? note.linkedTriggers : undefined,
          linkedEntities: Array.isArray(note?.linkedEntities) ? note.linkedEntities : undefined,
        },
      ),
    );
    normalized.sort((a, b) => a.number - b.number);
    return normalized.length ? normalized : [createQuestNote(1, "")];
  }

  if (typeof raw === "string" && raw.trim().length > 0) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return normalizeQuestNotes(parsed as QuestNote[]);
      }
    } catch {
      // fall through to legacy string handling
    }
    return [createQuestNote(1, raw)];
  }

  return [createQuestNote(1, "")];
}

function formatNotesForExport(notes: QuestNote[]): string {
  const sorted = [...notes].sort((a, b) => a.number - b.number);
  const lines = sorted
    .map((note) => ({
      number: note.number,
      text: note.text?.trim() ?? "",
    }))
    .filter((note) => note.text.length > 0)
    .map((note) => (note.number === 1 ? note.text : `${note.number}. ${note.text}`));
  return lines.join("\n\n");
}

export default function QuestBuilderPage() {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const mapColumnRef = useRef<HTMLDivElement | null>(null);
  const storyRef = useRef<HTMLTextAreaElement | null>(null);
  const notesContainerRef = useRef<HTMLDivElement | null>(null);
  const [items, setItems] = useState<PlacedItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wanderingIcon, setWanderingIcon] = useState<{ assetId: string; source: "builtin" | "custom" } | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isAssetsOpen, setIsAssetsOpen] = useState(false);
  const [isSavedQuestsOpen, setIsSavedQuestsOpen] = useState(false);
  const [isGameLogicOpen, setIsGameLogicOpen] = useState(false);
  const [quests, setQuests] = useState<QuestRecord[]>([]);
  const [currentQuestId, setCurrentQuestId] = useState<string | null>(null);
  const [paletteSearch, setPaletteSearch] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [iconLogic, setIconLogic] = useState<IconLogic[]>([]);
  const [form, setForm] = useState({
    title: "",
    campaign: "",
    author: "",
    story: "",
    notes: [createQuestNote(1, "")],
    wanderingMonster: "",
  });

  const refreshAssets = useCallback(async () => {
    try {
      const data = (await fetch("/api/assets").then((res) => res.json())) as Asset[];
      setAssets(data);
      return data;
    } catch {
      setAssets([]);
      return [];
    }
  }, []);

  useEffect(() => {
    refreshAssets();

    fetch("/api/quests")
      .then((res) => res.json())
      .then((data) => setQuests(data))
      .catch(() => setQuests([]));
  }, [refreshAssets]);

  const customAssets = useMemo<PaletteItem[]>(() => {
    return assets.filter((asset) => asset.category).map((asset) => {
      const gridW = resolveGridDimension(asset.gridW, asset.ratioW);
      const gridH = resolveGridDimension(asset.gridH, asset.ratioH);
      if (asset.category === "icon") {
        const iconCategory = iconCategoryForType(asset.iconType);
        return {
          id: asset.id,
          name: formatIconLabel(asset),
          url: `/api/assets/${asset.id}/blob`,
          category: iconCategory,
          gridW,
          gridH,
          layer: "monster",
          source: "custom",
          isIcon: true,
          paddingPct: asset.paddingPct ?? null,
        };
      }

      return {
        id: asset.id,
        name: asset.name,
        url: `/api/assets/${asset.id}/blob`,
        category: asset.category ?? "custom",
        gridW,
        gridH,
        layer: categoryToLayer(asset.category ?? "custom"),
        source: "custom",
        paddingPct: asset.paddingPct ?? null,
      };
    });
  }, [assets]);

  useEffect(() => {
    const mapColumn = mapColumnRef.current;
    const gridEl = gridRef.current;
    if (!mapColumn || !gridEl) return;

    const updateCellSize = () => {
      const available = mapColumn.clientWidth;
      if (!available) return;
      const borderRaw = getComputedStyle(gridEl).getPropertyValue("--hq-border").trim();
      const border = Number.parseFloat(borderRaw) || 0;
      const maxCell = 32;
      const minCell = 14;
      const computed = Math.floor((available - border * 2) / columns);
      const cellSize = Math.max(minCell, Math.min(maxCell, computed));
      gridEl.style.setProperty("--cell-size", `${cellSize}px`);
    };

    updateCellSize();
    const observer = new ResizeObserver(updateCellSize);
    observer.observe(mapColumn);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    autoSizeTextarea(storyRef.current);
  }, [form.story]);

  useEffect(() => {
    if (!notesContainerRef.current) return;
    const textareas = notesContainerRef.current.querySelectorAll("textarea");
    textareas.forEach((el) => autoSizeTextarea(el));
  }, [form.notes]);

  const paletteByCategory = useMemo(() => {
    const all = customAssets;
    const buckets: Record<string, PaletteItem[]> = {};
    for (const item of all) {
      const key = item.category || "custom";
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(item);
    }
    return buckets;
  }, [customAssets]);

  const paletteSections = useMemo(() => {
    const entries = Object.entries(paletteByCategory).filter(([category]) => category !== "custom");
    const order = [
      "monster",
      "hero",
      "npc",
      "boss",
      "minion",
      "ally",
      "villain",
      "furniture",
      "tile",
      "marking",
      "item",
      "trap",
      "objective",
      "other",
      "icon",
    ];
    const sortIndex = new Map(order.map((value, idx) => [value, idx]));

    const normalizedSearch = paletteSearch.trim().toLowerCase();
    const filtered = entries
      .map(([category, items]) => {
        const visibleItems = normalizedSearch
          ? items.filter((item) => item.name.toLowerCase().includes(normalizedSearch))
          : items;
        return [category, visibleItems] as const;
      })
      .filter(([, items]) => items.length > 0 || !normalizedSearch)
      .sort(([a], [b]) => {
        const aIdx = sortIndex.has(a) ? sortIndex.get(a)! : order.length + 1;
        const bIdx = sortIndex.has(b) ? sortIndex.get(b)! : order.length + 1;
        if (aIdx !== bIdx) return aIdx - bIdx;
        return a.localeCompare(b);
      });

    return filtered;
  }, [paletteByCategory, paletteSearch]);

  const handleDragStart = (item: PaletteItem, event: React.DragEvent) => {
    const payload = {
      type: "new" as const,
      assetId: item.id,
      source: item.source,
      url: item.url,
      gridW: item.gridW,
      gridH: item.gridH,
      layer: item.layer,
    };
    event.dataTransfer.setData("application/json", JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "copy";
  };

  const handleItemDragStart = (item: PlacedItem, event: React.DragEvent) => {
    const payload = { type: "move" as const, id: item.id };
    event.dataTransfer.setData("application/json", JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const data = event.dataTransfer.getData("application/json");
    if (!data || !gridRef.current) return;
    const payload = JSON.parse(data) as
      | {
          type?: "new";
          assetId: string;
          source: "builtin" | "custom";
          gridW: number;
          gridH: number;
          layer: "tile" | "furniture" | "monster";
        }
      | { type: "move"; id: string };

    const rect = gridRef.current.getBoundingClientRect();
    const gridLayer = gridRef.current.querySelector(`.${styles.gridLayer}`) as HTMLElement | null;
    const gridBase = gridRef.current.querySelector(`.${styles.gridBase}`) as HTMLElement | null;
    const cellSizeRaw = gridLayer
      ? getComputedStyle(gridLayer).getPropertyValue("--cell-size").trim()
      : "";
    const parsedCellSize = cellSizeRaw ? Number.parseFloat(cellSizeRaw) : Number.NaN;
    const cellSize = Number.isFinite(parsedCellSize) ? parsedCellSize : rect.width / columns;
    const borderLeft = gridBase ? Number.parseFloat(getComputedStyle(gridBase).borderLeftWidth) : 0;
    const borderTop = gridBase ? Number.parseFloat(getComputedStyle(gridBase).borderTopWidth) : 0;
    const rawX = (event.clientX - rect.left - borderLeft) / cellSize;
    const rawY = (event.clientY - rect.top - borderTop) / cellSize;
    const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
    const snapCell = (raw: number, max: number) => clamp(Math.round(raw - 0.5), 0, max - 1);
    const snapDoor = (rawXDoor: number, rawYDoor: number) => {
      const lineX = clamp(Math.round(rawXDoor), 1, columns - 1);
      const lineY = clamp(Math.round(rawYDoor), 1, rows - 1);
      const cellX = snapCell(rawXDoor, columns);
      const cellY = snapCell(rawYDoor, rows);
      const distX = Math.abs(rawXDoor - Math.round(rawXDoor));
      const distY = Math.abs(rawYDoor - Math.round(rawYDoor));
      if (distX <= distY) {
        return { x: lineX - 1, y: cellY, offsetX: 0.5, offsetY: 0 };
      }
      return { x: cellX, y: lineY - 1, offsetX: 0, offsetY: 0.5 };
    };
    const snapped = {
      x: clamp(Math.floor(rawX), 0, columns - 1),
      y: clamp(Math.floor(rawY), 0, rows - 1),
    };
    const x = snapped.x;
    const y = snapped.y;

    if (x < 0 || y < 0 || x >= columns || y >= rows) return;

    if ("type" in payload && payload.type === "move") {
      setItems((prev) => {
        const current = prev.find((item) => item.id === payload.id);
        if (!current) return prev;
        const isDoor = current.assetId === "furniture-door";
        const doorSnap = isDoor ? snapDoor(rawX, rawY) : null;
        const nextOffsetX = isDoor ? doorSnap!.offsetX : 0;
        const nextOffsetY = isDoor ? doorSnap!.offsetY : 0;
        const span = getSpan(current);
        const nextX = isDoor ? doorSnap!.x : x;
        const nextY = isDoor ? doorSnap!.y : y;
        if (nextX + span.w > columns || nextY + span.h > rows) return prev;
        if (
          isDoor &&
          ((nextOffsetX > 0 && nextX + span.w >= columns) || (nextOffsetY > 0 && nextY + span.h >= rows))
        ) {
          return prev;
        }

        const overlapsExisting = prev.some((item) => {
          if (item.id === current.id || item.layer !== current.layer) return false;
          const spanOther = getSpan(item);
          return overlaps(
            { x: item.x, y: item.y, w: spanOther.w, h: spanOther.h },
            { x: nextX, y: nextY, w: span.w, h: span.h },
          );
        });

        if (overlapsExisting) return prev;

        return prev.map((item) =>
          item.id === current.id
            ? { ...item, x: nextX, y: nextY, offsetX: nextOffsetX, offsetY: nextOffsetY }
            : item,
        );
      });
      setSelectedId(payload.id);
      return;
    }

    if (!("assetId" in payload)) return;
    const isDoor = payload.assetId === "furniture-door";
    const doorSnap = isDoor ? snapDoor(rawX, rawY) : null;
    const offsetX = isDoor ? doorSnap!.offsetX : 0;
    const offsetY = isDoor ? doorSnap!.offsetY : 0;
    const newX = isDoor ? doorSnap!.x : x;
    const newY = isDoor ? doorSnap!.y : y;
    if (newX + payload.gridW > columns || newY + payload.gridH > rows) return;
    if (
      isDoor &&
      ((offsetX > 0 && newX + payload.gridW >= columns) || (offsetY > 0 && newY + payload.gridH >= rows))
    ) {
      return;
    }

    const id = crypto.randomUUID();
    const newItem: PlacedItem = {
      id,
      assetId: payload.assetId,
      source: payload.source,
      x: newX,
      y: newY,
      baseW: payload.gridW,
      baseH: payload.gridH,
      spanW: payload.gridW,
      spanH: payload.gridH,
      rotation: 0,
      layer: payload.layer,
      offsetX,
      offsetY,
    };

    setItems((prev) => {
      const filtered = prev.filter((item) => {
        if (item.layer !== newItem.layer) return true;
        const span = getSpan(item);
        return !overlaps(
          { x: item.x, y: item.y, w: span.w, h: span.h },
          { x: newX, y: newY, w: payload.gridW, h: payload.gridH },
        );
      });
      return [...filtered, newItem];
    });
    setSelectedId(id);
  };

  const rotateItem = (item: PlacedItem) => {
    const nextRotation = (item.rotation + 90) % 360;
    const nextSpan = spanForRotation(item.baseW, item.baseH, nextRotation);
    if (item.x + nextSpan.w > columns || item.y + nextSpan.h > rows) {
      return item;
    }
    return {
      ...item,
      rotation: nextRotation,
      spanW: nextSpan.w,
      spanH: nextSpan.h,
    };
  };

  const handleItemClick = (id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? rotateItem(item) : item)));
    setSelectedId(id);
  };

  const handleDeleteSelected = () => {
    if (!selectedId) return;
    setItems((prev) => prev.filter((item) => item.id !== selectedId));
    setSelectedId(null);
  };

  const handleSave = async () => {
    const payload = {
      id: currentQuestId ?? undefined,
      title: form.title,
      campaign: form.campaign,
      author: form.author,
      story: form.story,
      notes: form.notes,
      wanderingMonster: form.wanderingMonster,
      data: { items, wandering: wanderingIcon, iconLogic },
    };

    const res = await fetch("/api/quests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      alert("Failed to save quest");
      return;
    }

    const saved = (await res.json()) as QuestRecord;
    setCurrentQuestId(saved.id);
    const updatedList = await fetch("/api/quests").then((r) => r.json());
    setQuests(updatedList);
    alert("Quest saved");
  };

  const handleLoad = (quest: QuestRecord) => {
    setCurrentQuestId(quest.id);
    setForm({
      title: quest.title ?? "",
      campaign: quest.campaign ?? "",
      author: quest.author ?? "",
      story: quest.story ?? "",
      notes: normalizeQuestNotes(quest.notes ?? null),
      wanderingMonster: quest.wanderingMonster ?? "",
    });
    const loadedItems =
      quest.data?.items?.map((item) => {
        const span = spanForRotation(item.baseW, item.baseH, item.rotation ?? 0);
        return {
          ...item,
          spanW: span.w,
          spanH: span.h,
          offsetX: item.assetId === "furniture-door" ? item.offsetX ?? 0.5 : item.offsetX ?? 0,
          offsetY: item.assetId === "furniture-door" ? item.offsetY ?? 0 : item.offsetY ?? 0,
        };
      }) ?? [];
    setItems(loadedItems);
    setWanderingIcon(quest.data?.wandering ?? null);
    setIconLogic(Array.isArray(quest.data?.iconLogic) ? quest.data?.iconLogic : []);
  };

  const handleNew = () => {
    setCurrentQuestId(null);
    setItems([]);
    setForm({
      title: "",
      campaign: "",
      author: "",
      story: "",
      notes: [createQuestNote(1, "")],
      wanderingMonster: "",
    });
    setWanderingIcon(null);
    setIconLogic([]);
  };

  const handleDeleteQuest = async (id: string) => {
    await fetch(`/api/quests/${id}`, { method: "DELETE" });
    const updatedList = await fetch("/api/quests").then((r) => r.json());
    setQuests(updatedList);
    if (currentQuestId === id) {
      handleNew();
    }
  };

  const handleExportPdf = async () => {
    const payload = {
      title: form.title,
      campaign: form.campaign,
      author: form.author,
      story: form.story,
      notes: formatNotesForExport(form.notes),
      wanderingMonster: form.wanderingMonster,
      data: { items, wandering: wanderingIcon, iconLogic },
    };

    const res = await fetch("/api/quests/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      alert("Failed to export PDF");
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeTitle = (form.title || "quest").toLowerCase().replace(/[^a-z0-9_-]+/gi, "_");
    link.href = url;
    link.download = `${safeTitle}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleWanderingDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const data = event.dataTransfer.getData("application/json");
    if (!data) return;
    const payload = JSON.parse(data) as {
      type?: "new";
      assetId: string;
      source: "builtin" | "custom";
    };
    if (!payload.assetId) return;
    setWanderingIcon({ assetId: payload.assetId, source: payload.source });
  };

  const itemById = useMemo(() => {
    const map = new Map<string, PaletteItem>();
    for (const item of customAssets) map.set(item.id, item);
    return map;
  }, [customAssets]);

  const wanderingPalette = wanderingIcon ? itemById.get(wanderingIcon.assetId) : null;
  const wanderingScale = getIconRenderScale(wanderingPalette ?? undefined);
  const getPaletteUrl = (item: PaletteItem) => item.url;
  const iconTargets = useMemo<IconTarget[]>(() => {
    const isCharacterCategory = (category?: string) =>
      Boolean(
        category &&
          ["monster", "hero", "npc", "boss", "minion", "ally", "villain"].includes(
            category.toLowerCase(),
          ),
      );
    return items
      .map((item) => {
        const palette = itemById.get(item.assetId);
        if (!palette) return null;
        const category = palette.category ?? "";
        const label = (() => {
          if (category === "marking") return `Marker ${palette.name}`;
          if (palette.isIcon || isCharacterCategory(category)) return palette.name || "Icon";
          const categoryLabel = category
            ? `${category.charAt(0).toUpperCase()}${category.slice(1)}`
            : "Item";
          return `${categoryLabel}: ${palette.name || "Item"}`;
        })();
        const numberLabel = category === "marking" ? palette.name : undefined;
        return {
          id: item.id,
          label,
          assetId: item.assetId,
          url: palette.url,
          x: item.x,
          y: item.y,
          numberLabel,
          baseW: item.baseW,
          baseH: item.baseH,
          spanW: item.spanW,
          spanH: item.spanH,
          rotation: item.rotation,
          offsetX: item.offsetX,
          offsetY: item.offsetY,
          layer: item.layer,
          paddingPct: palette.paddingPct ?? null,
          category: palette.category ?? null,
        } satisfies IconTarget;
      })
      .filter(Boolean) as IconTarget[];
  }, [items, itemById]);

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <img className={styles.logo} src="/static/img/ui/logo.png" alt="HeroQuest" />
        <strong>Quest Builder</strong>
        <div className={styles.toolbarActions}>
          <button type="button" onClick={handleNew}>
            <FilePlus className={styles.toolbarButtonIcon} aria-hidden="true" />
            New Quest
          </button>
          <button type="button" onClick={handleSave}>
            <Save className={styles.toolbarButtonIcon} aria-hidden="true" />
            Save Quest
          </button>
          <button type="button" onClick={() => setIsSavedQuestsOpen(true)}>
            <FolderOpen className={styles.toolbarButtonIcon} aria-hidden="true" />
            Saved Quests
          </button>
          <button type="button" onClick={() => setIsAssetsOpen(true)}>
            <Images className={styles.toolbarButtonIcon} aria-hidden="true" />
            Assets
          </button>
          <button type="button" onClick={handleExportPdf}>
            <FileDown className={styles.toolbarButtonIcon} aria-hidden="true" />
            Export PDF
          </button>
          <button type="button" onClick={handleDeleteSelected}>
            <Trash2 className={styles.toolbarButtonIcon} aria-hidden="true" />
            Delete Selected Item
          </button>
          <a href="/cards" className={styles.toolbarLink}>
            Card Builder →
          </a>
        </div>
      </div>
      <div className={styles.layout}>
        <aside className={`${styles.sidebar} ${styles.sidebarLeft}`}>
          <div>
            <div className={styles.sectionTitle}>Palette</div>
            <div className={styles.paletteSearch}>
              <input
                type="search"
                placeholder="Search palette..."
                value={paletteSearch}
                onChange={(event) => setPaletteSearch(event.target.value)}
              />
            </div>
            {paletteSections.map(([category, items]) => {
              const isCollapsed = collapsedSections[category] ?? false;
              const collapseAllowed = paletteSearch.trim().length === 0;
              const shouldCollapse = collapseAllowed && isCollapsed;
              return (
                <div key={category} style={{ marginTop: 12 }}>
                  <div className={styles.paletteHeader}>
                    <div className={styles.paletteTitle}>
                      {displayCategoryLabel(category)}{" "}
                      <span className={styles.paletteCount}>({items.length})</span>
                    </div>
                    <button
                      type="button"
                      className={styles.paletteToggle}
                      onClick={() =>
                        setCollapsedSections((prev) => ({
                          ...prev,
                          [category]: !isCollapsed,
                        }))
                      }
                    >
                      {shouldCollapse ? "Show" : "Hide"}
                    </button>
                  </div>
                  {!shouldCollapse ? (
                    <div className={styles.palette}>
                      {items.map((item) => {
                        const iconScale = getIconRenderScale(item);
                        return (
                          <div
                            key={item.id}
                            className={styles.paletteItem}
                            draggable
                            onDragStart={(event) => handleDragStart(item, event)}
                            title={`${item.name} (${item.gridW}x${item.gridH})`}
                          >
                            <img
                              src={getPaletteUrl(item)}
                              alt={item.name}
                              style={{
                                transform: `scale(${iconScale.scaleX}, ${iconScale.scaleY})`,
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </aside>

        <div className={styles.mapColumn} ref={mapColumnRef}>
          <div
            ref={gridRef}
            className={styles.gridWrapper}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <div className={`${styles.gridLayer} ${styles.gridBase}`}>
              {boardData.map((row, rowIndex) =>
                row.map((cell, colIndex) => {
                  const classes = [styles.cell];
                  if (cell.t === "corridor") classes.push(styles.corridor);
                  if (cell.b.includes("l")) classes.push(styles.borderLeft);
                  if (cell.b.includes("r")) classes.push(styles.borderRight);
                  if (cell.b.includes("t")) classes.push(styles.borderTop);
                  if (cell.b.includes("b")) classes.push(styles.borderBottom);
                  return (
                    <div key={`${rowIndex}-${colIndex}`} className={classes.join(" ")} />
                  );
                }),
              )}
            </div>
            <div className={`${styles.gridLayer} ${styles.gridItems}`}>
              {items.map((item) => {
                const palette = itemById.get(item.assetId);
                if (!palette) return null;
                const span = getSpan(item);
                const baseRatio = item.baseW / item.baseH;
                const rotateScale =
                  item.rotation % 180 === 0
                    ? 1
                    : Math.max(baseRatio, 1 / baseRatio);
                const scale = Number.isFinite(rotateScale) && rotateScale > 0 ? rotateScale : 1;
                const iconScale = getIconRenderScale(palette);
                const scaleX = scale * iconScale.scaleX;
                const scaleY = scale * iconScale.scaleY;
                const offsetX = item.offsetX ?? 0;
                const offsetY = item.offsetY ?? 0;
                const style: React.CSSProperties = {
                  gridColumn: `${item.x + 1} / span ${span.w}`,
                  gridRow: `${item.y + 1} / span ${span.h}`,
                  transform: `translate(${offsetX * 100}%, ${offsetY * 100}%)`,
                  zIndex: item.layer === "monster" ? 3 : item.layer === "furniture" ? 2 : 1,
                };
                return (
                  <div
                    key={item.id}
                    style={style}
                    className={selectedId === item.id ? styles.selectedCell : ""}
                  >
                    <div
                      className={styles.placedItem}
                      draggable
                      onDragStart={(event) => handleItemDragStart(item, event)}
                      onClick={() => handleItemClick(item.id)}
                    >
                      <img
                        src={getPaletteUrl(palette)}
                        alt={palette.name}
                        style={{
                          transform: `rotate(${item.rotation}deg) scale(${scaleX}, ${scaleY})`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className={styles.playTestRow}>
            <button type="button" onClick={() => setIsGameLogicOpen(true)}>
              <Settings className={styles.toolbarButtonIcon} aria-hidden="true" />
              Game Logic Builder
            </button>
          </div>
        </div>

        <aside className={`${styles.sidebar} ${styles.sidebarRight}`}>
          <div className={styles.sectionTitle}>Quest Details</div>
          <div className={styles.formGroup}>
            <input
              placeholder="Title"
              className={styles.notesSingleLine}
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
            <input
              placeholder="Campaign"
              className={styles.notesSingleLine}
              value={form.campaign}
              onChange={(e) => setForm((prev) => ({ ...prev, campaign: e.target.value }))}
            />
            <input
              placeholder="Author"
              className={styles.notesSingleLine}
              value={form.author}
              onChange={(e) => setForm((prev) => ({ ...prev, author: e.target.value }))}
            />
            <textarea
              placeholder="Story"
              rows={4}
              className={styles.notesBlock}
              ref={storyRef}
              value={form.story}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, story: e.target.value }));
                autoSizeTextarea(e.currentTarget);
              }}
            />
            <div className={styles.notesSection} ref={notesContainerRef}>
              <div className={styles.notesHeaderRow}>
                <span className={styles.notesHeaderLabel}>Notes</span>
                <button
                  type="button"
                  className={styles.addNoteButton}
                  onClick={() =>
                    setForm((prev) => {
                      const maxNumber = prev.notes.reduce(
                        (max, note) => (note.number > max ? note.number : max),
                        0,
                      );
                      const nextNumber = Math.max(1, maxNumber + 1);
                      return {
                        ...prev,
                        notes: [...prev.notes, createQuestNote(nextNumber, "")],
                      };
                    })
                  }
                >
                  + Add Note
                </button>
              </div>
              <div className={styles.notesList}>
                {form.notes.map((note) => (
                  <div key={note.id} className={styles.noteField}>
                    <div className={styles.noteLabel}>
                      {note.number === 1 ? "General Note" : `Note ${note.number}`}
                    </div>
                    <textarea
                      rows={3}
                      className={styles.notesBlock}
                      placeholder={note.number === 1 ? "General note" : `Note ${note.number}`}
                      value={note.text}
                      onChange={(e) => {
                        const nextText = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          notes: prev.notes.map((entry) =>
                            entry.id === note.id ? { ...entry, text: nextText } : entry,
                          ),
                        }));
                        autoSizeTextarea(e.currentTarget);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.wanderingRow}>
              <input
                placeholder="Wandering Monster"
                className={styles.notesSingleLine}
                value={form.wanderingMonster}
                onChange={(e) => setForm((prev) => ({ ...prev, wanderingMonster: e.target.value }))}
              />
              <div
                className={styles.wanderingCell}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleWanderingDrop}
                onClick={() => setWanderingIcon(null)}
                title="Drop a monster here (click to clear)"
              >
                {wanderingPalette ? (
                  <img
                    src={getPaletteUrl(wanderingPalette)}
                    alt="Wandering Monster"
                    style={{
                      transform: `scale(${wanderingScale.scaleX}, ${wanderingScale.scaleY})`,
                    }}
                  />
                ) : (
                  <span>Drop</span>
                )}
              </div>
            </div>
          </div>

        </aside>
      </div>
      <SavedQuestsModal
        isOpen={isSavedQuestsOpen}
        onClose={() => setIsSavedQuestsOpen(false)}
        quests={quests}
        currentQuestId={currentQuestId}
        onLoadQuest={(quest) => {
          handleLoad(quest);
          setIsSavedQuestsOpen(false);
        }}
        onDeleteQuest={handleDeleteQuest}
      />
      <GameLogicBuilderModal
        isOpen={isGameLogicOpen}
        onClose={() => setIsGameLogicOpen(false)}
        iconTargets={iconTargets}
        notes={form.notes}
        initialLogic={iconLogic}
        onSave={(nextLogic) => {
          setIconLogic(nextLogic);
          setIsGameLogicOpen(false);
        }}
      />
      <QuestAssetsModal
        isOpen={isAssetsOpen}
        onClose={() => {
          setIsAssetsOpen(false);
          refreshAssets();
        }}
        onRefreshAssets={refreshAssets}
      />
    </div>
  );
}
