"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileDown, FilePlus, Save, Trash2 } from "lucide-react";
import boardData from "@/data/boardData";
import { formatIconLabel, ICON_TYPE_OPTIONS } from "@/lib/icon-assets";
import styles from "./quest.module.css";

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
  notes?: string | null;
  wanderingMonster?: string | null;
  data?: { items: PlacedItem[]; wandering?: { assetId: string; source: "builtin" | "custom" } | null } | null;
  createdAt?: number;
  updatedAt?: number;
};

const builtInAssets: PaletteItem[] = [
  { id: "monster-goblin", name: "Goblin", url: "/static/img/Monsters/goblin.svg", category: "monster", gridW: 1, gridH: 1, layer: "monster", source: "builtin" },
  { id: "monster-orc", name: "Orc", url: "/static/img/Monsters/orc.svg", category: "monster", gridW: 1, gridH: 1, layer: "monster", source: "builtin" },
  { id: "monster-zombie", name: "Zombie", url: "/static/img/Monsters/zombie.svg", category: "monster", gridW: 1, gridH: 1, layer: "monster", source: "builtin" },
  { id: "monster-mummy", name: "Mummy", url: "/static/img/Monsters/mummy.svg", category: "monster", gridW: 1, gridH: 1, layer: "monster", source: "builtin" },
  { id: "monster-skeleton", name: "Skeleton", url: "/static/img/Monsters/skeleton.svg", category: "monster", gridW: 1, gridH: 1, layer: "monster", source: "builtin" },
  { id: "monster-abomination", name: "Abomination", url: "/static/img/Monsters/abomination.svg", category: "monster", gridW: 1, gridH: 1, layer: "monster", source: "builtin" },
  { id: "monster-doom-warrior", name: "Doom Warrior", url: "/static/img/Monsters/doom_warrior.svg", category: "monster", gridW: 1, gridH: 1, layer: "monster", source: "builtin" },
  { id: "monster-gargoyle", name: "Gargoyle", url: "/static/img/Monsters/gargoyle.svg", category: "monster", gridW: 1, gridH: 1, layer: "monster", source: "builtin" },
  { id: "monster-chaos-sorcerer", name: "Chaos Sorcerer", url: "/static/img/Monsters/chaossorcerer.svg", category: "monster", gridW: 1, gridH: 1, layer: "monster", source: "builtin" },
  { id: "hero-barbarian", name: "Barbarian", url: "/static/img/Heroes/barbarian.svg", category: "hero", gridW: 1, gridH: 1, layer: "monster", source: "builtin" },
  { id: "hero-dwarf", name: "Dwarf", url: "/static/img/Heroes/dwarf.svg", category: "hero", gridW: 1, gridH: 1, layer: "monster", source: "builtin" },
  { id: "hero-elf", name: "Elf", url: "/static/img/Heroes/elf.svg", category: "hero", gridW: 1, gridH: 1, layer: "monster", source: "builtin" },
  { id: "hero-wizard", name: "Wizard", url: "/static/img/Heroes/wizard.svg", category: "hero", gridW: 1, gridH: 1, layer: "monster", source: "builtin" },
  { id: "furniture-block-single", name: "Block Single", url: "/static/img/Furniture/block_single.svg", category: "furniture", gridW: 1, gridH: 1, layer: "furniture", source: "builtin" },
  { id: "furniture-block-double", name: "Block Double", url: "/static/img/Furniture/block_double.svg", category: "furniture", gridW: 2, gridH: 1, layer: "furniture", source: "builtin" },
  { id: "furniture-bookcase", name: "Bookcase", url: "/static/img/Furniture/bookcase.svg", category: "furniture", gridW: 3, gridH: 1, layer: "furniture", source: "builtin" },
  { id: "furniture-cupboard", name: "Cupboard", url: "/static/img/Furniture/cupboard.svg", category: "furniture", gridW: 3, gridH: 1, layer: "furniture", source: "builtin" },
  { id: "furniture-fireplace", name: "Fireplace", url: "/static/img/Furniture/fireplace.svg", category: "furniture", gridW: 3, gridH: 1, layer: "furniture", source: "builtin" },
  { id: "furniture-weapon-rack", name: "Weapon Rack", url: "/static/img/Furniture/weapon_rack.svg", category: "furniture", gridW: 3, gridH: 1, layer: "furniture", source: "builtin" },
  { id: "furniture-stairs", name: "Stairs", url: "/static/img/Furniture/stairs.svg", category: "furniture", gridW: 2, gridH: 2, layer: "furniture", source: "builtin" },
  { id: "furniture-table", name: "Table", url: "/static/img/Furniture/table.svg", category: "furniture", gridW: 3, gridH: 2, layer: "furniture", source: "builtin" },
  { id: "furniture-alchemists-desk", name: "Alchemist Desk", url: "/static/img/Furniture/alchemists_desk.svg", category: "furniture", gridW: 3, gridH: 2, layer: "furniture", source: "builtin" },
  { id: "furniture-torture-rack", name: "Torture Rack", url: "/static/img/Furniture/torture_rack.svg", category: "furniture", gridW: 3, gridH: 2, layer: "furniture", source: "builtin" },
  { id: "furniture-tomb", name: "Tomb", url: "/static/img/Furniture/tomb.svg", category: "furniture", gridW: 2, gridH: 3, layer: "furniture", source: "builtin" },
  { id: "furniture-sorcerers-table", name: "Sorcerer Table", url: "/static/img/Furniture/sorcerers_table.svg", category: "furniture", gridW: 2, gridH: 3, layer: "furniture", source: "builtin" },
  { id: "furniture-throne", name: "Throne", url: "/static/img/Furniture/throne.svg", category: "furniture", gridW: 1, gridH: 1, layer: "furniture", source: "builtin" },
  { id: "furniture-chest", name: "Chest", url: "/static/img/Furniture/chest.svg", category: "furniture", gridW: 1, gridH: 1, layer: "furniture", source: "builtin" },
  { id: "furniture-chesttrap", name: "Chest Trap", url: "/static/img/Furniture/chesttrap.svg", category: "furniture", gridW: 1, gridH: 1, layer: "furniture", source: "builtin" },
  { id: "furniture-door", name: "Door", url: "/static/img/Furniture/door.svg", category: "furniture", gridW: 1, gridH: 1, layer: "furniture", source: "builtin" },
  { id: "furniture-secret-door", name: "Secret Door", url: "/static/img/Furniture/secret_door.svg", category: "furniture", gridW: 1, gridH: 1, layer: "furniture", source: "builtin" },
  { id: "tile-trap-pit", name: "Trap Pit", url: "/static/img/Furniture/trap_pit.svg", category: "tile", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "tile-trap-spear", name: "Trap Spear", url: "/static/img/Furniture/trap_spear.svg", category: "tile", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "tile-trap-block", name: "Trap Block", url: "/static/img/Furniture/trap_block.svg", category: "tile", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "mark-arrow-diagonal", name: "Arrow Diagonal", url: "/static/img/Markings/arrow_diagonal.svg", category: "marking", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "mark-arrow", name: "Arrow", url: "/static/img/Markings/arrow.svg", category: "marking", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "mark-A", name: "A", url: "/static/img/Markings/letterA.svg", category: "marking", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "mark-B", name: "B", url: "/static/img/Markings/letterB.svg", category: "marking", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "mark-C", name: "C", url: "/static/img/Markings/letterC.svg", category: "marking", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "mark-D", name: "D", url: "/static/img/Markings/letterD.svg", category: "marking", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "mark-E", name: "E", url: "/static/img/Markings/letterE.svg", category: "marking", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "mark-F", name: "F", url: "/static/img/Markings/letterF.svg", category: "marking", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "mark-G", name: "G", url: "/static/img/Markings/letterG.svg", category: "marking", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "mark-H", name: "H", url: "/static/img/Markings/letterH.svg", category: "marking", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "mark-I", name: "I", url: "/static/img/Markings/letterI.svg", category: "marking", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "mark-J", name: "J", url: "/static/img/Markings/letterJ.svg", category: "marking", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "mark-K", name: "K", url: "/static/img/Markings/letterK.svg", category: "marking", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "mark-L", name: "L", url: "/static/img/Markings/letterL.svg", category: "marking", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "mark-M", name: "M", url: "/static/img/Markings/letterM.svg", category: "marking", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "mark-1", name: "1", url: "/static/img/Markings/number1.svg", category: "marking", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "mark-2", name: "2", url: "/static/img/Markings/number2.svg", category: "marking", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "mark-3", name: "3", url: "/static/img/Markings/number3.svg", category: "marking", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "mark-4", name: "4", url: "/static/img/Markings/number4.svg", category: "marking", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "mark-5", name: "5", url: "/static/img/Markings/number5.svg", category: "marking", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "mark-6", name: "6", url: "/static/img/Markings/number6.svg", category: "marking", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "mark-7", name: "7", url: "/static/img/Markings/number7.svg", category: "marking", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "mark-8", name: "8", url: "/static/img/Markings/number8.svg", category: "marking", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "mark-9", name: "9", url: "/static/img/Markings/number9.svg", category: "marking", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
  { id: "mark-10", name: "10", url: "/static/img/Markings/number10.svg", category: "marking", gridW: 1, gridH: 1, layer: "tile", source: "builtin" },
];

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

async function getImageDimensionsFromFile(file: File) {
  const isSvg = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
  if (isSvg) {
    try {
      const text = await file.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "image/svg+xml");
      const svg = doc.querySelector("svg");
      const widthAttr = svg?.getAttribute("width");
      const heightAttr = svg?.getAttribute("height");
      const parseLength = (value: string | null) => {
        if (!value) return 0;
        const num = Number.parseFloat(value);
        return Number.isFinite(num) ? num : 0;
      };
      let width = parseLength(widthAttr);
      let height = parseLength(heightAttr);
      if (!width || !height) {
        const viewBox = svg?.getAttribute("viewBox");
        if (viewBox) {
          const parts = viewBox.split(/[ ,]+/).map((part) => Number.parseFloat(part));
          if (parts.length === 4) {
            width = width || parts[2] || 0;
            height = height || parts[3] || 0;
          }
        }
      }
      if (!width || !height) {
        width = width || 256;
        height = height || 256;
      }
      return { width, height };
    } catch {
      return { width: 256, height: 256 };
    }
  }

  const img = new Image();
  img.src = URL.createObjectURL(file);
  await new Promise((resolve) => {
    img.onload = resolve;
    img.onerror = resolve;
  });
  const width = img.naturalWidth || 0;
  const height = img.naturalHeight || 0;
  URL.revokeObjectURL(img.src);
  return { width, height };
}

export default function QuestBuilderPage() {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const mapColumnRef = useRef<HTMLDivElement | null>(null);
  const storyRef = useRef<HTMLTextAreaElement | null>(null);
  const notesRef = useRef<HTMLTextAreaElement | null>(null);
  const [items, setItems] = useState<PlacedItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wanderingIcon, setWanderingIcon] = useState<{ assetId: string; source: "builtin" | "custom" } | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [quests, setQuests] = useState<QuestRecord[]>([]);
  const [currentQuestId, setCurrentQuestId] = useState<string | null>(null);
  const [paletteSearch, setPaletteSearch] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({
    title: "",
    campaign: "",
    author: "",
    story: "",
    notes: "",
    wanderingMonster: "",
  });
  const [upload, setUpload] = useState({
    category: "monster",
    gridW: 1,
    gridH: 1,
    iconType: ICON_TYPE_OPTIONS[0] ?? "Monster",
    iconName: "",
  });

  useEffect(() => {
    fetch("/api/assets")
      .then((res) => res.json())
      .then((data) => setAssets(data))
      .catch(() => setAssets([]));

    fetch("/api/quests")
      .then((res) => res.json())
      .then((data) => setQuests(data))
      .catch(() => setQuests([]));
  }, []);

  const customAssets = useMemo<PaletteItem[]>(() => {
    return assets.map((asset) => {
      if (asset.category === "icon") {
        const iconCategory = iconCategoryForType(asset.iconType);
        return {
          id: asset.id,
          name: formatIconLabel(asset),
          url: `/api/assets/${asset.id}/blob`,
          category: iconCategory,
          gridW: 1,
          gridH: 1,
          layer: "monster",
          source: "custom",
          isIcon: true,
        };
      }

      return {
        id: asset.id,
        name: asset.name,
        url: `/api/assets/${asset.id}/blob`,
        category: asset.category ?? "custom",
        gridW: asset.gridW ?? 1,
        gridH: asset.gridH ?? 1,
        layer: categoryToLayer(asset.category ?? "custom"),
        source: "custom",
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
    const autoSize = (el: HTMLTextAreaElement | null) => {
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    autoSize(storyRef.current);
    autoSize(notesRef.current);
  }, [form.story, form.notes]);

  const paletteByCategory = useMemo(() => {
    const all = [...builtInAssets, ...customAssets];
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
      data: { items, wandering: wanderingIcon },
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
      notes: quest.notes ?? "",
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
  };

  const handleNew = () => {
    setCurrentQuestId(null);
    setItems([]);
    setForm({ title: "", campaign: "", author: "", story: "", notes: "", wanderingMonster: "" });
    setWanderingIcon(null);
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
      notes: form.notes,
      wanderingMonster: form.wanderingMonster,
      data: { items, wandering: wanderingIcon },
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

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const fileInput = formEl.querySelector<HTMLInputElement>("input[type=file]");
    const file = fileInput?.files?.[0];
    if (!file) return;
    const isIconUpload = upload.category === "icon";
    if (isIconUpload && !upload.iconName.trim()) {
      alert("Please enter an icon name.");
      return;
    }

    const { width, height } = await getImageDimensionsFromFile(file);
    const mimeType =
      file.type || (file.name.toLowerCase().endsWith(".svg") ? "image/svg+xml" : "image/png");

    const formData = new FormData();
    formData.append("file", file, file.name);
    formData.append("name", file.name);
    formData.append("mimeType", mimeType);
    formData.append("width", String(width));
    formData.append("height", String(height));
    formData.append("category", upload.category);
    formData.append("gridW", String(isIconUpload ? 1 : upload.gridW));
    formData.append("gridH", String(isIconUpload ? 1 : upload.gridH));
    if (isIconUpload) {
      formData.append("iconType", upload.iconType);
      formData.append("iconName", upload.iconName.trim());
    }

    const res = await fetch("/api/assets", { method: "POST", body: formData });
    if (!res.ok) {
      alert("Upload failed");
      return;
    }

    const updated = await fetch("/api/assets").then((r) => r.json());
    setAssets(updated);
    formEl.reset();
    if (isIconUpload) {
      setUpload((prev) => ({ ...prev, iconName: "" }));
    }
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
    for (const item of builtInAssets) map.set(item.id, item);
    for (const item of customAssets) map.set(item.id, item);
    return map;
  }, [customAssets]);

  const wanderingPalette = wanderingIcon ? itemById.get(wanderingIcon.assetId) : null;
  const wanderingLabel = wanderingPalette?.name ?? form.wanderingMonster ?? "";
  const getPaletteUrl = (item: PaletteItem) => item.url;

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
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className={styles.paletteItem}
                          draggable
                          onDragStart={(event) => handleDragStart(item, event)}
                          title={`${item.name} (${item.gridW}x${item.gridH})`}
                        >
                      <img src={getPaletteUrl(item)} alt={item.name} />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div>
            <div className={styles.sectionTitle}>Upload Custom Icon</div>
            <form onSubmit={handleUpload} className={styles.formGroup}>
              <input type="file" accept="image/png,image/svg+xml" />
              <label>Category</label>
              <select
                value={upload.category}
                onChange={(e) =>
                  setUpload((prev) => ({
                    ...prev,
                    category: e.target.value,
                    gridW: e.target.value === "icon" ? 1 : prev.gridW,
                    gridH: e.target.value === "icon" ? 1 : prev.gridH,
                  }))
                }
              >
                <option value="monster">Monster</option>
                <option value="furniture">Furniture</option>
                <option value="tile">Tile</option>
                <option value="marking">Marking</option>
                <option value="icon">Icon</option>
              </select>
              {upload.category === "icon" ? (
                <>
                  <label>Icon Type</label>
                  <select
                    value={upload.iconType}
                    onChange={(e) =>
                      setUpload((prev) => ({ ...prev, iconType: e.target.value }))
                    }
                  >
                    {ICON_TYPE_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                  <label>Icon Name</label>
                  <input
                    type="text"
                    value={upload.iconName}
                    onChange={(e) =>
                      setUpload((prev) => ({ ...prev, iconName: e.target.value }))
                    }
                  />
                </>
              ) : null}
              <label>Grid Width</label>
              <select
                value={upload.gridW}
                disabled={upload.category === "icon"}
                onChange={(e) =>
                  setUpload((prev) => ({ ...prev, gridW: Number(e.target.value) }))
                }
              >
                {[1,2,3].map((n) => (<option key={n} value={n}>{n}</option>))}
              </select>
              <label>Grid Height</label>
              <select
                value={upload.gridH}
                disabled={upload.category === "icon"}
                onChange={(e) =>
                  setUpload((prev) => ({ ...prev, gridH: Number(e.target.value) }))
                }
              >
                {[1,2,3].map((n) => (<option key={n} value={n}>{n}</option>))}
              </select>
              <button type="submit">Upload</button>
            </form>
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
              const offsetX = item.offsetX ?? 0;
              const offsetY = item.offsetY ?? 0;
              const style: React.CSSProperties = {
                gridColumn: `${item.x + 1} / span ${span.w}`,
                gridRow: `${item.y + 1} / span ${span.h}`,
                transform: `translate(${offsetX * 100}%, ${offsetY * 100}%)`,
                zIndex: item.layer === "monster" ? 3 : item.layer === "furniture" ? 2 : 1,
              };
              return (
                <div key={item.id} style={style} className={selectedId === item.id ? styles.selectedCell : ""}>
                  <div
                    className={styles.placedItem}
                    draggable
                    onDragStart={(event) => handleItemDragStart(item, event)}
                    onClick={() => handleItemClick(item.id)}
                  >
                    <img
                      src={getPaletteUrl(palette)}
                      alt={palette.name}
                      style={{ transform: `rotate(${item.rotation}deg) scale(${scale})` }}
                    />
                  </div>
                </div>
              );
            })}
            </div>
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
                e.currentTarget.style.height = "auto";
                e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
              }}
            />
            <textarea
              placeholder="Notes"
              rows={4}
              className={styles.notesBlock}
              ref={notesRef}
              value={form.notes}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, notes: e.target.value }));
                e.currentTarget.style.height = "auto";
                e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
              }}
            />
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
                  <img src={getPaletteUrl(wanderingPalette)} alt="Wandering Monster" />
                ) : (
                  <span>Drop</span>
                )}
              </div>
            </div>
          </div>

          <div className={styles.savedQuests}>
            <div className={styles.sectionTitle}>Saved Quests</div>
            <div className={styles.questList}>
              {quests.length === 0 ? (
                <div>No saved quests yet.</div>
              ) : (
                quests.map((quest) => (
                  <div key={quest.id} style={{ display: "flex", gap: 6 }}>
                    <button type="button" onClick={() => handleLoad(quest)}>
                      {quest.title || "Untitled"}
                    </button>
                    <button type="button" onClick={() => handleDeleteQuest(quest.id)}>Delete</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
