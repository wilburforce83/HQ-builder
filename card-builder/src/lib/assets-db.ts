"use client";

export type AssetRecord = {
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

export type AssetRecordWithBlob = AssetRecord & {
  blob: Blob;
};

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

export async function addAsset(
  id: string,
  blob: Blob,
  meta: Omit<AssetRecord, "id" | "createdAt">,
): Promise<void> {
  const form = new FormData();
  form.append("file", blob, meta.name);
  form.append("id", id);
  form.append("name", meta.name);
  form.append("mimeType", meta.mimeType);
  form.append("width", String(meta.width));
  form.append("height", String(meta.height));
  if (meta.category) form.append("category", meta.category);
  if (meta.gridW != null) form.append("gridW", String(meta.gridW));
  if (meta.gridH != null) form.append("gridH", String(meta.gridH));
  if (meta.iconType) form.append("iconType", meta.iconType);
  if (meta.iconName) form.append("iconName", meta.iconName);

  await fetchJson(`${API_BASE}/assets`, {
    method: "POST",
    body: form,
  });
}

export async function getAllAssets(options?: {
  category?: string;
  excludeCategory?: string;
}): Promise<AssetRecord[]> {
  const params = new URLSearchParams();
  if (options?.category) params.set("category", options.category);
  if (options?.excludeCategory) params.set("excludeCategory", options.excludeCategory);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const data = (await fetchJson(`${API_BASE}/assets${suffix}`)) as AssetRecord[];
  return data ?? [];
}

export async function getAllAssetsWithBlobs(options?: {
  category?: string;
  excludeCategory?: string;
}): Promise<AssetRecordWithBlob[]> {
  const records = await getAllAssets(options);
  const results: AssetRecordWithBlob[] = [];

  for (const record of records) {
    const blob = await getAssetBlob(record.id);
    if (!blob) continue;
    results.push({ ...record, blob });
  }

  return results;
}

export async function getAssetObjectUrl(id: string): Promise<string | null> {
  const blob = await getAssetBlob(id);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export async function getAssetBlob(id: string): Promise<Blob | null> {
  const response = await fetch(`${API_BASE}/assets/${id}/blob`, {
    credentials: "same-origin",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }

  return response.blob();
}

export async function deleteAssets(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await fetchJson(`${API_BASE}/assets`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids }),
  });
}
