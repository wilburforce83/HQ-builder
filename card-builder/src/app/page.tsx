"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import boardData from "@/data/boardData";
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
};

type QuestRecord = {
  id: string;
  title?: string | null;
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
  { id: "furniture-table", name: "Table", url: "/static/img/Furniture/table.svg", category: "furniture", gridW: 2, gridH: 3, layer: "furniture", source: "builtin" },
  { id: "furniture-alchemists-desk", name: "Alchemist Desk", url: "/static/img/Furniture/alchemists_desk.svg", category: "furniture", gridW: 2, gridH: 3, layer: "furniture", source: "builtin" },
  { id: "furniture-torture-rack", name: "Torture Rack", url: "/static/img/Furniture/torture_rack.svg", category: "furniture", gridW: 2, gridH: 3, layer: "furniture", source: "builtin" },
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
  if (category === "monster" || category === "hero") return "monster" as const;
  if (category === "furniture") return "furniture" as const;
  return "tile" as const;
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
  const [assetRatios, setAssetRatios] = useState<Record<string, number>>({});
  const [currentQuestId, setCurrentQuestId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    author: "",
    story: "",
    notes: "",
    wanderingMonster: "",
  });
  const [upload, setUpload] = useState({
    category: "monster",
    gridW: 1,
    gridH: 1,
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

  const customAssets = useMemo<PaletteItem[]>(() => {
    return assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      url: `/api/assets/${asset.id}/blob`,
      category: asset.category ?? "custom",
      gridW: asset.gridW ?? 1,
      gridH: asset.gridH ?? 1,
      layer: categoryToLayer(asset.category ?? "custom"),
      source: "custom",
    }));
  }, [assets]);

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
    const x = Math.floor((event.clientX - rect.left - borderLeft) / cellSize);
    const y = Math.floor((event.clientY - rect.top - borderTop) / cellSize);

    if (x < 0 || y < 0 || x >= columns || y >= rows) return;

    if ("type" in payload && payload.type === "move") {
      setItems((prev) => {
        const current = prev.find((item) => item.id === payload.id);
        if (!current) return prev;
        const span = getSpan(current);
        if (x + span.w > columns || y + span.h > rows) return prev;

        const overlapsExisting = prev.some((item) => {
          if (item.id === current.id || item.layer !== current.layer) return false;
          const spanOther = getSpan(item);
          return overlaps(
            { x: item.x, y: item.y, w: spanOther.w, h: spanOther.h },
            { x, y, w: span.w, h: span.h },
          );
        });

        if (overlapsExisting) return prev;

        return prev.map((item) => (item.id === current.id ? { ...item, x, y } : item));
      });
      setSelectedId(payload.id);
      return;
    }

    if (!("assetId" in payload)) return;
    if (x + payload.gridW > columns || y + payload.gridH > rows) return;

    const id = crypto.randomUUID();
    const newItem: PlacedItem = {
      id,
      assetId: payload.assetId,
      source: payload.source,
      x,
      y,
      baseW: payload.gridW,
      baseH: payload.gridH,
      spanW: payload.gridW,
      spanH: payload.gridH,
      rotation: 0,
      layer: payload.layer,
    };

    setItems((prev) => {
      const filtered = prev.filter((item) => {
        if (item.layer !== newItem.layer) return true;
        const span = getSpan(item);
        return !overlaps({ x: item.x, y: item.y, w: span.w, h: span.h }, { x, y, w: payload.gridW, h: payload.gridH });
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
      author: quest.author ?? "",
      story: quest.story ?? "",
      notes: quest.notes ?? "",
      wanderingMonster: quest.wanderingMonster ?? "",
    });
    const loadedItems =
      quest.data?.items?.map((item) => {
        const span = spanForRotation(item.baseW, item.baseH, item.rotation ?? 0);
        return { ...item, spanW: span.w, spanH: span.h };
      }) ?? [];
    setItems(loadedItems);
    setWanderingIcon(quest.data?.wandering ?? null);
  };

  const handleNew = () => {
    setCurrentQuestId(null);
    setItems([]);
    setForm({ title: "", author: "", story: "", notes: "", wanderingMonster: "" });
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

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const fileInput = formEl.querySelector<HTMLInputElement>("input[type=file]");
    const file = fileInput?.files?.[0];
    if (!file) return;

    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });

    const formData = new FormData();
    formData.append("file", file, file.name);
    formData.append("name", file.name);
    formData.append("mimeType", file.type || "image/png");
    formData.append("width", String(img.naturalWidth || 0));
    formData.append("height", String(img.naturalHeight || 0));
    formData.append("category", upload.category);
    formData.append("gridW", String(upload.gridW));
    formData.append("gridH", String(upload.gridH));

    URL.revokeObjectURL(img.src);

    const res = await fetch("/api/assets", { method: "POST", body: formData });
    if (!res.ok) {
      alert("Upload failed");
      return;
    }

    const updated = await fetch("/api/assets").then((r) => r.json());
    setAssets(updated);
    formEl.reset();
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

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <img className={styles.logo} src="/static/img/ui/logo.png" alt="HeroQuest" />
        <strong>HeroQuest Quest Builder</strong>
        <button type="button" onClick={handleNew}>New Quest</button>
        <button type="button" onClick={handleSave}>Save Quest</button>
        <button type="button" onClick={() => window.print()}>Print</button>
        <button type="button" onClick={handleDeleteSelected}>Delete Selected Item</button>
        <a href="/cards" style={{ marginLeft: "auto", textDecoration: "none" }}>Card Builder →</a>
      </div>
      <div className={styles.layout}>
        <aside className={`${styles.sidebar} ${styles.sidebarLeft}`}>
          <div>
            <div className={styles.sectionTitle}>Palette</div>
            {Object.entries(paletteByCategory).map(([category, items]) => (
              <div key={category} style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{category}</div>
                <div className={styles.palette}>
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={styles.paletteItem}
                      draggable
                      onDragStart={(event) => handleDragStart(item, event)}
                      title={`${item.name} (${item.gridW}x${item.gridH})`}
                    >
                      <img src={item.url} alt={item.name} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div>
            <div className={styles.sectionTitle}>Upload Custom Icon</div>
            <form onSubmit={handleUpload} className={styles.formGroup}>
              <input type="file" accept="image/png" />
              <label>Category</label>
              <select value={upload.category} onChange={(e) => setUpload((prev) => ({ ...prev, category: e.target.value }))}>
                <option value="monster">Monster</option>
                <option value="furniture">Furniture</option>
                <option value="tile">Tile</option>
                <option value="marking">Marking</option>
              </select>
              <label>Grid Width</label>
              <select value={upload.gridW} onChange={(e) => setUpload((prev) => ({ ...prev, gridW: Number(e.target.value) }))}>
                {[1,2,3].map((n) => (<option key={n} value={n}>{n}</option>))}
              </select>
              <label>Grid Height</label>
              <select value={upload.gridH} onChange={(e) => setUpload((prev) => ({ ...prev, gridH: Number(e.target.value) }))}>
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
              const containerRatio = span.w / span.h;
              const intrinsicRatio = assetRatios[palette.id] ?? containerRatio;
              const rotationMod = item.rotation % 180;
              const effectiveRatio = rotationMod === 0 ? intrinsicRatio : 1 / intrinsicRatio;
              const rawScale = Math.max(effectiveRatio / containerRatio, containerRatio / effectiveRatio);
              const scale = Number.isFinite(rawScale) ? rawScale : 1;
              const style: React.CSSProperties = {
                gridColumn: `${item.x + 1} / span ${span.w}`,
                gridRow: `${item.y + 1} / span ${span.h}`,
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
                      src={palette.url}
                      alt={palette.name}
                      onLoad={(event) => {
                        const target = event.currentTarget;
                        const ratio =
                          target.naturalWidth && target.naturalHeight
                            ? target.naturalWidth / target.naturalHeight
                            : 1;
                        setAssetRatios((prev) => (prev[palette.id] ? prev : { ...prev, [palette.id]: ratio }));
                      }}
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
                {wanderingPalette ? <img src={wanderingPalette.url} alt="Wandering Monster" /> : <span>Drop</span>}
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
