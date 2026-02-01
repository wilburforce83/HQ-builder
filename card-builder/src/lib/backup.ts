"use client";

import type { CardRecord } from "@/types/cards-db";

import type { AssetRecord } from "./assets-db";
import JSZip from "jszip";
import { listCards, createCard, deleteCards } from "./cards-db";
import { getAllAssets, getAllAssetsWithBlobs, addAsset, deleteAssets } from "./assets-db";
import { listCollections, createCollection, deleteCollection } from "./collections-db";

export const BACKUP_SCHEMA_VERSION = 1 as const;
export const BACKUP_FILE_EXTENSION = ".hqcc.json" as const;
export const BACKUP_CONTAINER_EXTENSION = ".hqcc" as const;

export type HqccExportSchemaVersion = typeof BACKUP_SCHEMA_VERSION;

export type CardRecordExportV1 = Omit<CardRecord, "thumbnailBlob"> & {
  thumbnailDataUrl?: string | null;
};

export type AssetRecordExportV1 = AssetRecord & {
  dataUrl: string;
};

export interface CollectionRecordExportV1 {
  id: string;
  name: string;
  nameLower: string;
  createdAt: number;
  updatedAt: number;
  schemaVersion: 1;
  cardIds?: string[];
  templateId?: string | null;
  statusFilter?: "draft" | "saved" | "archived" | null;
}

export interface HqccExportLocalStorageV1 {
  cardDraftsV1?: string | null;
  activeCardsV1?: string | null;
  statLabels?: string | null;
}

export interface HqccExportFileV1 {
  schemaVersion: HqccExportSchemaVersion;
  createdAt: string;
  appVersion?: string;
  notes?: string;
  cards: CardRecordExportV1[];
  assets: AssetRecordExportV1[];
  collections?: CollectionRecordExportV1[];
  localStorage: HqccExportLocalStorageV1;
}

export type ExportResult = {
  blob: Blob;
  fileName: string;
  meta: {
    cardsCount: number;
    assetsCount: number;
    collectionsCount: number;
  };
};

export type ImportResult = {
  cardsCount: number;
  assetsCount: number;
  collectionsCount: number;
};

export type BackupProgressPhase = "export" | "import";
export type BackupProgressCallback = (current: number, total: number, phase: BackupProgressPhase) => void;
export type BackupStatusPhase = "preparing" | "processing" | "finalizing";
export type BackupStatusCallback = (phase: BackupStatusPhase) => void;
export type BackupSecondaryProgressCallback = (percent: number, phase: BackupStatusPhase) => void;

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read blob as data URL"));
    };

    reader.onload = () => {
      const { result } = reader;
      if (typeof result !== "string") {
        reject(new Error("Unexpected FileReader result type"));
        return;
      }
      resolve(result);
    };

    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  if (!dataUrl.startsWith("data:")) {
    throw new Error("Invalid data URL: missing data: prefix");
  }

  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) {
    throw new Error("Invalid data URL: missing comma separator");
  }

  const meta = dataUrl.slice(5, commaIndex); // after "data:"
  const payload = dataUrl.slice(commaIndex + 1);

  const parts = meta.split(";");
  const mimeType = parts[0] || "application/octet-stream";
  const isBase64 = parts.includes("base64");

  let binaryString: string;
  try {
    if (isBase64) {
      binaryString = atob(payload);
    } else {
      binaryString = decodeURIComponent(payload);
    }
  } catch {
    throw new Error("Invalid data URL: failed to decode payload");
  }

  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return new Blob([bytes], { type: mimeType });
}

function parseBackupJson(text: string): HqccExportFileV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("This file is not a valid HeroQuest Card Maker backup");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("This file is not a valid HeroQuest Card Maker backup");
  }

  const candidate = parsed as Partial<HqccExportFileV1>;

  if (typeof candidate.schemaVersion !== "number") {
    throw new Error("This file is not a valid HeroQuest Card Maker backup");
  }

  if (candidate.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error("This backup was created by an incompatible version of the app");
  }

  if (!Array.isArray(candidate.cards) || !Array.isArray(candidate.assets)) {
    throw new Error("This file is not a valid HeroQuest Card Maker backup");
  }

  if (!candidate.localStorage || typeof candidate.localStorage !== "object") {
    throw new Error("This file is not a valid HeroQuest Card Maker backup");
  }

  return candidate as HqccExportFileV1;
}

async function buildExportObject(
  onProgress?: BackupProgressCallback,
): Promise<HqccExportFileV1> {
  if (typeof window === "undefined") {
    throw new Error("Backup export is only available in the browser");
  }

  const rawCards = await listCards();
  const rawAssets = await getAllAssetsWithBlobs();
  const rawCollections = await listCollections();

  const cards: CardRecordExportV1[] = [];
  const totalProgressCount = rawCards.length + rawAssets.length;
  let processedCount = 0;
  for (const value of rawCards) {
    const { thumbnailBlob, ...rest } = value;
    const exportRecord: CardRecordExportV1 = {
      ...rest,
    };

    if (thumbnailBlob instanceof Blob) {
      try {
        exportRecord.thumbnailDataUrl = await blobToDataUrl(thumbnailBlob);
      } catch {
        // Ignore thumbnail encoding errors; continue without thumbnail
      }
    }

    cards.push(exportRecord);
    processedCount += 1;
    onProgress?.(processedCount, totalProgressCount, "export");
  }

  const assets: AssetRecordExportV1[] = [];
  for (const value of rawAssets) {
    const { id, name, mimeType, width, height, createdAt, blob } = value;

    if (blob instanceof Blob) {
      try {
        const dataUrl = await blobToDataUrl(blob);
        assets.push({
          id,
          name,
          mimeType,
          width,
          height,
          createdAt,
          dataUrl,
        });
      } catch {
        // Ignore individual asset encoding errors; continue with others
      }
    }
    processedCount += 1;
    onProgress?.(processedCount, totalProgressCount, "export");
  }

  if (totalProgressCount > 0) {
    onProgress?.(totalProgressCount, totalProgressCount, "export");
  }

  const collections: CollectionRecordExportV1[] = rawCollections.map((collection) => ({
    id: collection.id,
    name: collection.name,
    nameLower: collection.name.toLocaleLowerCase(),
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
    schemaVersion: 1,
    cardIds: collection.cardIds,
  }));

  let cardDraftsV1: string | null | undefined;
  let activeCardsV1: string | null | undefined;
  let statLabels: string | null | undefined;

  try {
    cardDraftsV1 = window.localStorage.getItem("hqcc.cardDrafts.v1");
  } catch {
    cardDraftsV1 = undefined;
  }

  try {
    activeCardsV1 = window.localStorage.getItem("hqcc.activeCards.v1");
  } catch {
    activeCardsV1 = undefined;
  }

  try {
    statLabels = window.localStorage.getItem("hqcc.statLabels");
  } catch {
    statLabels = undefined;
  }

  const localStorage: HqccExportLocalStorageV1 = {
    cardDraftsV1,
    activeCardsV1,
    statLabels,
  };

  const exportObject: HqccExportFileV1 = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    cards,
    assets,
    collections,
    localStorage,
  };

  return exportObject;
}

async function applyBackupObject(
  exportData: HqccExportFileV1,
  onProgress?: BackupProgressCallback,
): Promise<ImportResult> {
  if (exportData.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error("Incompatible backup version");
  }

  if (!Array.isArray(exportData.cards) || !Array.isArray(exportData.assets)) {
    throw new Error("Invalid backup file structure");
  }

  if (!exportData.localStorage || typeof exportData.localStorage !== "object") {
    throw new Error("Invalid backup file: missing localStorage section");
  }

  if (typeof window === "undefined") {
    throw new Error("Backup import is only available in the browser");
  }

  const existingCards = await listCards();
  if (existingCards.length) {
    await deleteCards(existingCards.map((card) => card.id));
  }

  const existingAssets = await getAllAssets();
  if (existingAssets.length) {
    await deleteAssets(existingAssets.map((asset) => asset.id));
  }

  const existingCollections = await listCollections();
  for (const collection of existingCollections) {
    await deleteCollection(collection.id);
  }

  let cardsCount = 0;
  let assetsCount = 0;
  let collectionsCount = 0;
  const total =
    exportData.assets.length +
    exportData.cards.length +
    (Array.isArray(exportData.collections) ? exportData.collections.length : 0);

  if (exportData.assets.length > 0) {
    for (const assetExport of exportData.assets) {
      try {
        const blob = dataUrlToBlob(assetExport.dataUrl);
        await addAsset(assetExport.id, blob, {
          name: assetExport.name,
          mimeType: assetExport.mimeType,
          width: assetExport.width,
          height: assetExport.height,
        });
        assetsCount += 1;
        onProgress?.(assetsCount + cardsCount + collectionsCount, total, "import");
      } catch {
        // Skip invalid asset entries
      }
    }
  }

  if (exportData.cards.length > 0) {
    for (const cardExport of exportData.cards) {
      let thumbnailBlob: Blob | null = null;
      if (cardExport.thumbnailDataUrl) {
        try {
          thumbnailBlob = dataUrlToBlob(cardExport.thumbnailDataUrl);
        } catch {
          thumbnailBlob = null;
        }
      }

      const { thumbnailDataUrl, ...rest } = cardExport;
      await createCard({
        ...(rest as CardRecord),
        thumbnailBlob,
      });
      cardsCount += 1;
      onProgress?.(assetsCount + cardsCount + collectionsCount, total, "import");
    }
  }

  if (Array.isArray(exportData.collections) && exportData.collections.length) {
    for (const collection of exportData.collections) {
      await createCollection({
        id: collection.id,
        name: collection.name,
        cardIds: collection.cardIds ?? [],
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
        schemaVersion: collection.schemaVersion,
      });
      collectionsCount += 1;
      onProgress?.(assetsCount + cardsCount + collectionsCount, total, "import");
    }
  }

  try {
    const { cardDraftsV1, activeCardsV1, statLabels } = exportData.localStorage;
    if (typeof cardDraftsV1 === "string") {
      window.localStorage.setItem("hqcc.cardDrafts.v1", cardDraftsV1);
    }
    if (typeof activeCardsV1 === "string") {
      window.localStorage.setItem("hqcc.activeCards.v1", activeCardsV1);
    }
    if (typeof statLabels === "string") {
      window.localStorage.setItem("hqcc.statLabels", statLabels);
    }
  } catch {
    // Ignore localStorage restore errors
  }

  return {
    cardsCount,
    assetsCount,
    collectionsCount,
  };
}

export async function createBackupJson(
  options?: {
    onProgress?: BackupProgressCallback;
    onStatus?: BackupStatusCallback;
    onSecondaryProgress?: BackupSecondaryProgressCallback;
  },
): Promise<ExportResult> {
  options?.onStatus?.("processing");
  const exportObject = await buildExportObject(options?.onProgress);

  const json = JSON.stringify(exportObject, null, 2);
  const blob = new Blob([json], { type: "application/json" });

  const now = new Date();
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const timestamp =
    [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join("") +
    "-" +
    [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join("");

  const fileName = `heroquest-card-maker-backup-${timestamp}${BACKUP_FILE_EXTENSION}`;

  return {
    blob,
    fileName,
    meta: {
      cardsCount: exportObject.cards.length,
      assetsCount: exportObject.assets.length,
      collectionsCount: Array.isArray(exportObject.collections)
        ? exportObject.collections.length
        : 0,
    },
  };
}

export async function importBackupJson(
  file: File,
  options?: {
    onProgress?: BackupProgressCallback;
    onStatus?: BackupStatusCallback;
    onSecondaryProgress?: BackupSecondaryProgressCallback;
  },
): Promise<ImportResult> {
  options?.onStatus?.("preparing");
  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new Error("Could not read the selected backup file");
  }

  const exportData = parseBackupJson(text);

  options?.onStatus?.("processing");
  return applyBackupObject(exportData, options?.onProgress);
}

export async function createBackupHqcc(
  options?: {
    onProgress?: BackupProgressCallback;
    onStatus?: BackupStatusCallback;
    onSecondaryProgress?: BackupSecondaryProgressCallback;
  },
): Promise<ExportResult> {
  options?.onStatus?.("processing");
  const exportObject = await buildExportObject(options?.onProgress);
  const json = JSON.stringify(exportObject, null, 2);

  const zip = new JSZip();
  zip.file("backup.json", json);

  options?.onStatus?.("finalizing");
  await new Promise((resolve) => setTimeout(resolve, 250));
  const blob = await zip.generateAsync(
    { type: "blob" },
    (metadata) => {
      options?.onSecondaryProgress?.(metadata.percent ?? 0, "finalizing");
    },
  );

  const now = new Date();
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const timestamp =
    [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join("") +
    "-" +
    [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join("");

  const fileName = `heroquest-card-maker-backup-${timestamp}${BACKUP_CONTAINER_EXTENSION}`;

  return {
    blob,
    fileName,
    meta: {
      cardsCount: exportObject.cards.length,
      assetsCount: exportObject.assets.length,
      collectionsCount: Array.isArray(exportObject.collections)
        ? exportObject.collections.length
        : 0,
    },
  };
}

export async function importBackupHqcc(
  file: File,
  options?: {
    onProgress?: BackupProgressCallback;
    onStatus?: BackupStatusCallback;
    onSecondaryProgress?: BackupSecondaryProgressCallback;
  },
): Promise<ImportResult> {
  options?.onStatus?.("preparing");
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error("This file is not a valid HeroQuest Card Maker backup");
  }

  const entry = zip.file("backup.json");
  if (!entry) {
    throw new Error("This file is not a valid HeroQuest Card Maker backup");
  }

  let text: string;
  try {
    text = await entry.async("string");
  } catch {
    throw new Error("Could not read backup data from this file");
  }

  const exportData = parseBackupJson(text);

  options?.onStatus?.("processing");
  return applyBackupObject(exportData, options?.onProgress);
}
