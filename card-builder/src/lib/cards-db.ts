"use client";

import type { CardRecord, CardStatus } from "@/types/cards-db";
import type { TemplateId } from "@/types/templates";

import { generateId } from ".";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

type CardApiRecord = Omit<CardRecord, "thumbnailBlob"> & {
  thumbnailDataUrl?: string | null;
};

export type CardCreateInput = Omit<
  CardRecord,
  "id" | "createdAt" | "updatedAt" | "nameLower" | "schemaVersion"
> & {
  id?: string;
  createdAt?: number;
  updatedAt?: number;
  nameLower?: string;
  schemaVersion?: 1;
  thumbnailBlob?: Blob | null;
};

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read blob"));
    reader.onload = () => resolve(reader.result as string);
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

  const meta = dataUrl.slice(5, commaIndex);
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

async function serializeCardPayload(
  record: Partial<CardRecord> & { thumbnailBlob?: Blob | null },
): Promise<Partial<CardApiRecord>> {
  const { thumbnailBlob, ...rest } = record;
  const payload: Partial<CardApiRecord> = { ...rest } as Partial<CardApiRecord>;

  if (thumbnailBlob instanceof Blob) {
    payload.thumbnailDataUrl = await blobToDataUrl(thumbnailBlob);
  } else if (thumbnailBlob === null) {
    payload.thumbnailDataUrl = null;
  }

  return payload;
}

function normalizeCard(raw: CardApiRecord): CardRecord {
  const { thumbnailDataUrl, ...rest } = raw;
  const thumbnailBlob = thumbnailDataUrl ? dataUrlToBlob(thumbnailDataUrl) : null;
  return {
    ...rest,
    thumbnailBlob,
  } as CardRecord;
}

async function fetchJson(path: string, options?: RequestInit): Promise<unknown> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function createCard(input: CardCreateInput): Promise<CardRecord> {
  const now = Date.now();
  const id = input.id ?? generateId();
  const createdAt = input.createdAt ?? now;
  const updatedAt = input.updatedAt ?? now;
  const nameLower = input.nameLower ?? input.name.toLocaleLowerCase();
  const schemaVersion: 1 = 1;

  const payload = await serializeCardPayload({
    ...input,
    id,
    createdAt,
    updatedAt,
    nameLower,
    schemaVersion,
  });

  const data = (await fetchJson(`${API_BASE}/cards`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })) as CardApiRecord;

  return normalizeCard(data);
}

export async function updateCard(
  id: string,
  patch: Partial<Omit<CardRecord, "id" | "createdAt" | "schemaVersion">> & {
    thumbnailBlob?: Blob | null;
  },
): Promise<CardRecord | null> {
  const payload = await serializeCardPayload(patch);

  const response = await fetch(`${API_BASE}/cards/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }

  const data = (await response.json()) as CardApiRecord;
  return normalizeCard(data);
}

export async function getCard(id: string): Promise<CardRecord | null> {
  const response = await fetch(`${API_BASE}/cards/${id}`, {
    credentials: "same-origin",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }

  const data = (await response.json()) as CardApiRecord;
  return normalizeCard(data);
}

export type ListCardsFilter = {
  templateId?: TemplateId;
  status?: CardStatus;
  search?: string;
};

export async function listCards(filter: ListCardsFilter = {}): Promise<CardRecord[]> {
  const params = new URLSearchParams();
  if (filter.templateId) params.set("templateId", filter.templateId);
  if (filter.status) params.set("status", filter.status);
  if (filter.search) params.set("search", filter.search);

  const query = params.toString();
  const path = query ? `${API_BASE}/cards?${query}` : `${API_BASE}/cards`;

  const data = (await fetchJson(path)) as CardApiRecord[];
  return data.map((record) => normalizeCard(record));
}

export async function deleteCard(id: string): Promise<void> {
  await fetchJson(`${API_BASE}/cards/${id}`, {
    method: "DELETE",
  });
}

export async function deleteCards(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await fetchJson(`${API_BASE}/cards`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids }),
  });
}
