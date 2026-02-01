"use client";

import type { CollectionRecord } from "@/types/collections-db";

import { generateId } from ".";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

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

export async function createCollection(input: {
  id?: string;
  name: string;
  description?: string;
  cardIds?: string[];
  createdAt?: number;
  updatedAt?: number;
  schemaVersion?: number;
}): Promise<CollectionRecord> {
  const now = Date.now();
  const record: CollectionRecord = {
    id: input.id ?? generateId(),
    name: input.name,
    description: input.description,
    cardIds: input.cardIds ?? [],
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    schemaVersion: input.schemaVersion ?? 1,
  };

  const data = (await fetchJson(`${API_BASE}/collections`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(record),
  })) as CollectionRecord;

  return data;
}

export async function updateCollection(
  id: string,
  patch: Partial<Omit<CollectionRecord, "id" | "createdAt" | "schemaVersion">> & {
    schemaVersion?: number;
  },
): Promise<CollectionRecord | null> {
  const response = await fetch(`${API_BASE}/collections/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify(patch),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }

  return (await response.json()) as CollectionRecord;
}

export async function getCollection(id: string): Promise<CollectionRecord | null> {
  const collections = await listCollections();
  return collections.find((collection) => collection.id === id) ?? null;
}

export async function listCollections(): Promise<CollectionRecord[]> {
  const data = (await fetchJson(`${API_BASE}/collections`)) as CollectionRecord[];
  return data ?? [];
}

export async function deleteCollection(id: string): Promise<void> {
  await fetchJson(`${API_BASE}/collections/${id}`, {
    method: "DELETE",
  });
}
