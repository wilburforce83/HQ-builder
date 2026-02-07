"use client";

import { Save, Search, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import styles from "@/app/page.module.css";
import IconButton from "@/components/IconButton";
import ModalShell from "@/components/ModalShell";
import type { AssetRecord } from "@/lib/assets-db";
import {
  deleteAssets,
  getAssetObjectUrl,
  updateAssetMeta,
} from "@/lib/assets-db";
import { formatIconLabel, ICON_TYPE_OPTIONS } from "@/lib/icon-assets";
import {
  loadCustomIconTypes,
  mergeIconTypes,
  saveCustomIconTypes,
} from "@/lib/icon-type-storage";

type QuestAssetsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onRefreshAssets: () => Promise<AssetRecord[]>;
};

type AssetDraft = {
  id: string;
  name: string;
  iconType: string;
  iconName: string;
  gridW: string;
  gridH: string;
  paddingPct: string;
};

const DEFAULT_GRID = 1;
const DEFAULT_PADDING = 0;

function normalizeGridValue(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.max(1, Math.round(value));
}

function resolveGridDimension(
  gridValue: number | null | undefined,
  ratioValue: number | null | undefined,
  fallback = DEFAULT_GRID,
) {
  return normalizeGridValue(gridValue) ?? normalizeGridValue(ratioValue) ?? fallback;
}

function toDraft(asset: AssetRecord): AssetDraft {
  return {
    id: asset.id,
    name: asset.name ?? "",
    iconType: asset.iconType ?? "",
    iconName: asset.iconName ?? "",
    gridW: String(resolveGridDimension(asset.gridW, asset.ratioW)),
    gridH: String(resolveGridDimension(asset.gridH, asset.ratioH)),
    paddingPct: String(asset.paddingPct ?? DEFAULT_PADDING),
  };
}

function parseGridDimension(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parsePadding(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 0), 100);
}

function computeScale(paddingPct: number) {
  const base = 1 - Math.min(Math.max(paddingPct, 0), 100) / 100;
  return {
    scaleX: base,
    scaleY: base,
  };
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

function normalizeAsset(asset: AssetRecord) {
  return {
    name: asset.name.trim(),
    iconType: asset.iconType?.trim() ?? "",
    iconName: asset.iconName?.trim() ?? "",
    gridW: resolveGridDimension(asset.gridW, asset.ratioW),
    gridH: resolveGridDimension(asset.gridH, asset.ratioH),
    paddingPct: asset.paddingPct ?? DEFAULT_PADDING,
  };
}

function sameNumber(a: number, b: number) {
  return Math.abs(a - b) < 0.0001;
}

export default function QuestAssetsModal({
  isOpen,
  onClose,
  onRefreshAssets,
}: QuestAssetsModalProps) {
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AssetDraft | null>(null);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [newType, setNewType] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const defaultIconType = ICON_TYPE_OPTIONS[0] ?? "Monster";
  const [upload, setUpload] = useState({
    category: "monster",
    gridW: String(DEFAULT_GRID),
    gridH: String(DEFAULT_GRID),
    iconType: defaultIconType,
    iconName: "",
  });

  const refreshAssets = useCallback(async () => {
    const all = await onRefreshAssets().catch(() => []);
    const paletteAssets = all.filter((asset) => asset.category);
    setAssets(paletteAssets);
    return paletteAssets;
  }, [onRefreshAssets]);

  useEffect(() => {
    if (!isOpen) return;
    setCustomTypes(loadCustomIconTypes());
    refreshAssets();
  }, [isOpen, refreshAssets]);

  useEffect(() => {
    if (!isOpen || assets.length === 0) {
      setThumbUrls({});
      return;
    }

    let cancelled = false;
    const localUrls: Record<string, string> = {};

    (async () => {
      for (const asset of assets) {
        try {
          const url = await getAssetObjectUrl(asset.id);
          if (!url) continue;
          localUrls[asset.id] = url;
        } catch {
          // Ignore asset errors.
        }
      }
      if (!cancelled) {
        setThumbUrls(localUrls);
      } else {
        Object.values(localUrls).forEach((url) => URL.revokeObjectURL(url));
      }
    })();

    return () => {
      cancelled = true;
      Object.values(localUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [isOpen, assets]);

  useEffect(() => {
    if (!selectedId) {
      setDraft(null);
      return;
    }
    const asset = assets.find((item) => item.id === selectedId);
    if (!asset) {
      setSelectedId(null);
      setDraft(null);
      return;
    }
    setDraft(toDraft(asset));
  }, [assets, selectedId]);

  const typeOptions = useMemo(() => {
    const assetTypes = assets
      .map((asset) => asset.iconType)
      .filter((value): value is string => Boolean(value));
    return mergeIconTypes([...ICON_TYPE_OPTIONS], customTypes, assetTypes);
  }, [assets, customTypes]);

  useEffect(() => {
    if (upload.category !== "icon") return;
    if (!typeOptions.length) return;
    if (typeOptions.includes(upload.iconType)) return;
    setUpload((prev) => ({ ...prev, iconType: typeOptions[0] ?? prev.iconType }));
  }, [typeOptions, upload.category, upload.iconType]);

  const filteredAssets = useMemo(() => {
    if (!search) return assets;
    const term = search.toLowerCase();
    return assets.filter((asset) => {
      if (asset.name.toLowerCase().includes(term)) return true;
      if (asset.iconName && asset.iconName.toLowerCase().includes(term)) return true;
      if (asset.iconType && asset.iconType.toLowerCase().includes(term)) return true;
      return false;
    });
  }, [assets, search]);

  const selectedAsset = selectedId ? assets.find((asset) => asset.id === selectedId) : null;
  const isIconAsset = selectedAsset?.category === "icon";

  const normalizedDraft = draft
    ? {
        name: draft.name.trim(),
        iconType: draft.iconType.trim(),
        iconName: draft.iconName.trim(),
        gridW: parseGridDimension(draft.gridW, DEFAULT_GRID),
        gridH: parseGridDimension(draft.gridH, DEFAULT_GRID),
        paddingPct: parsePadding(draft.paddingPct, DEFAULT_PADDING),
      }
    : null;

  const isDirty = (() => {
    if (!selectedAsset || !normalizedDraft) return false;
    const base = normalizeAsset(selectedAsset);
    if (base.name !== normalizedDraft.name) return true;
    if (selectedAsset.category === "icon") {
      if (base.iconType !== normalizedDraft.iconType) return true;
      if (base.iconName !== normalizedDraft.iconName) return true;
    }
    if (!sameNumber(base.gridW, normalizedDraft.gridW)) return true;
    if (!sameNumber(base.gridH, normalizedDraft.gridH)) return true;
    if (!sameNumber(base.paddingPct, normalizedDraft.paddingPct)) return true;
    return false;
  })();

  const isValid = Boolean(normalizedDraft?.name);

  const previewScale = normalizedDraft
    ? computeScale(normalizedDraft.paddingPct)
    : { scaleX: 1, scaleY: 1 };

  const handleAddType = () => {
    const value = newType.trim();
    if (!value) return;
    const isDefault = ICON_TYPE_OPTIONS.some(
      (option) => option.toLowerCase() === value.toLowerCase(),
    );
    const nextCustom = isDefault ? customTypes : mergeIconTypes(customTypes, [value]);
    setCustomTypes(nextCustom);
    saveCustomIconTypes(nextCustom);
    setNewType("");
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      window.alert("Please choose an image to upload.");
      return;
    }

    const isIconUpload = upload.category === "icon";
    if (isIconUpload && !upload.iconName.trim()) {
      window.alert("Please enter an icon name.");
      return;
    }

    const iconTypeValue = upload.iconType.trim();
    if (isIconUpload && iconTypeValue) {
      const isDefault = ICON_TYPE_OPTIONS.some(
        (option) => option.toLowerCase() === iconTypeValue.toLowerCase(),
      );
      const alreadyStored = customTypes.some(
        (option) => option.toLowerCase() === iconTypeValue.toLowerCase(),
      );
      if (!isDefault && !alreadyStored) {
        const nextCustom = mergeIconTypes(customTypes, [iconTypeValue]);
        setCustomTypes(nextCustom);
        saveCustomIconTypes(nextCustom);
      }
    }

    const { width, height } = await getImageDimensionsFromFile(file);
    const mimeType =
      file.type || (file.name.toLowerCase().endsWith(".svg") ? "image/svg+xml" : "image/png");

    const gridW = parseGridDimension(upload.gridW, DEFAULT_GRID);
    const gridH = parseGridDimension(upload.gridH, DEFAULT_GRID);

    const formData = new FormData();
    formData.append("file", file, file.name);
    formData.append("name", file.name);
    formData.append("mimeType", mimeType);
    formData.append("width", String(width));
    formData.append("height", String(height));
    formData.append("category", upload.category);
    formData.append("gridW", String(gridW));
    formData.append("gridH", String(gridH));
    if (isIconUpload) {
      formData.append("iconType", iconTypeValue);
      formData.append("iconName", upload.iconName.trim());
    }

    const res = await fetch("/api/assets", { method: "POST", body: formData });
    if (!res.ok) {
      window.alert("Upload failed.");
      return;
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (isIconUpload) {
      setUpload((prev) => ({ ...prev, iconName: "" }));
    }
    await refreshAssets();
  };

  const handleSave = async () => {
    if (!selectedAsset || !normalizedDraft) return;
    if (!isValid) {
      window.alert("Please enter a name for the icon.");
      return;
    }
    setIsSaving(true);
    try {
      const patch: Parameters<typeof updateAssetMeta>[1] = {
        name: normalizedDraft.name,
        gridW: normalizedDraft.gridW,
        gridH: normalizedDraft.gridH,
        paddingPct: normalizedDraft.paddingPct,
      };

      if (selectedAsset.category === "icon") {
        const iconTypeValue = normalizedDraft.iconType || null;
        const iconNameValue = normalizedDraft.iconName || null;

        if (iconTypeValue) {
          const isDefault = ICON_TYPE_OPTIONS.some(
            (option) => option.toLowerCase() === iconTypeValue.toLowerCase(),
          );
          const alreadyStored = customTypes.some(
            (option) => option.toLowerCase() === iconTypeValue.toLowerCase(),
          );
          if (!isDefault && !alreadyStored) {
            const nextCustom = mergeIconTypes(customTypes, [iconTypeValue]);
            setCustomTypes(nextCustom);
            saveCustomIconTypes(nextCustom);
          }
        }

        patch.iconType = iconTypeValue;
        patch.iconName = iconNameValue;
      }

      await updateAssetMeta(selectedAsset.id, patch);
      await refreshAssets();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[QuestAssetsModal] Failed to update asset", error);
      window.alert("Failed to update asset.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAsset) return;
    if (!window.confirm(`Delete ${formatIconLabel(selectedAsset)}?`)) return;
    setIsDeleting(true);
    try {
      await deleteAssets([selectedAsset.id]);
      setSelectedId(null);
      await refreshAssets();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[QuestAssetsModal] Failed to delete asset", error);
      window.alert("Failed to delete asset.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Assets"
      contentClassName={styles.assetsPopover}
    >
      <div className={styles.assetsToolbar}>
        <div className="input-group input-group-sm" style={{ maxWidth: 260 }}>
          <span className="input-group-text">
            <Search className={styles.icon} aria-hidden="true" />
          </span>
          <input
            type="search"
            placeholder="Search assets..."
            className={`form-control form-control-sm bg-white text-dark ${styles.assetsSearch}`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className={styles.assetsToolbarSpacer} />
      </div>
      <datalist id="quest-icon-types">
        {typeOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      <div className={styles.questAssetsTypeRow}>
        <div className={styles.questAssetsTypeField}>
          <label className="form-label">Add Type Section</label>
          <input
            className="form-control form-control-sm"
            type="text"
            value={newType}
            onChange={(event) => setNewType(event.target.value)}
            placeholder="e.g. Elite"
          />
        </div>
        <button
          type="button"
          className={`btn btn-outline-secondary btn-sm ${styles.questAssetsTypeButton}`}
          onClick={handleAddType}
          disabled={!newType.trim()}
        >
          Add Type
        </button>
      </div>
      <form className={styles.questAssetsUpload} onSubmit={handleUpload}>
        <div className={styles.questAssetsUploadTitle}>Add Asset</div>
        <div className={styles.questAssetsUploadFields}>
          <div className={styles.questAssetsUploadField}>
            <label className="form-label">Image File</label>
            <input
              ref={fileInputRef}
              className="form-control form-control-sm"
              type="file"
              accept="image/png,image/svg+xml"
            />
          </div>
          <div className={styles.questAssetsUploadField}>
            <label className="form-label">Category</label>
            <select
              className="form-select form-select-sm"
              value={upload.category}
              onChange={(event) =>
                setUpload((prev) => ({
                  ...prev,
                  category: event.target.value,
                }))
              }
            >
              <option value="monster">Monster</option>
              <option value="furniture">Furniture</option>
              <option value="tile">Tile</option>
              <option value="marking">Marking</option>
              <option value="icon">Icon</option>
            </select>
          </div>
          <div className={styles.questAssetsUploadField}>
            <label className="form-label">Grid Width</label>
            <input
              className="form-control form-control-sm"
              type="number"
              min="1"
              step="1"
              value={upload.gridW}
              onChange={(event) =>
                setUpload((prev) => ({ ...prev, gridW: event.target.value }))
              }
            />
          </div>
          <div className={styles.questAssetsUploadField}>
            <label className="form-label">Grid Height</label>
            <input
              className="form-control form-control-sm"
              type="number"
              min="1"
              step="1"
              value={upload.gridH}
              onChange={(event) =>
                setUpload((prev) => ({ ...prev, gridH: event.target.value }))
              }
            />
          </div>
          {upload.category === "icon" ? (
            <>
              <div className={styles.questAssetsUploadField}>
                <label className="form-label">Icon Type</label>
                <input
                  className="form-control form-control-sm"
                  type="text"
                  list="quest-icon-types"
                  value={upload.iconType}
                  onChange={(event) =>
                    setUpload((prev) => ({ ...prev, iconType: event.target.value }))
                  }
                  placeholder="e.g. Monster"
                />
              </div>
              <div className={styles.questAssetsUploadField}>
                <label className="form-label">Icon Name</label>
                <input
                  className="form-control form-control-sm"
                  type="text"
                  value={upload.iconName}
                  onChange={(event) =>
                    setUpload((prev) => ({ ...prev, iconName: event.target.value }))
                  }
                  placeholder="e.g. Goblin"
                />
              </div>
            </>
          ) : null}
        </div>
        <div className={styles.questAssetsUploadActions}>
          <IconButton className="btn btn-primary btn-sm" icon={Upload} type="submit">
            Upload Asset
          </IconButton>
        </div>
      </form>
      <div className={styles.questAssetsLayout}>
        <div className={styles.assetsGridContainer}>
          {filteredAssets.length === 0 ? (
            <div className={styles.assetsEmptyState}>No assets found.</div>
          ) : (
            <div className={styles.assetsGrid}>
              {filteredAssets.map((asset) => {
                const displayName = formatIconLabel(asset);
                const isSelected = asset.id === selectedId;
                return (
                  <button
                    key={asset.id}
                    type="button"
                    className={`${styles.assetsItem} ${isSelected ? styles.assetsItemSelected : ""}`}
                    title={displayName}
                    onClick={() => setSelectedId(asset.id)}
                  >
                    <div className={styles.assetsThumbPlaceholder}>
                      {thumbUrls[asset.id] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumbUrls[asset.id]}
                          alt={displayName}
                          className={styles.assetsThumbImage}
                        />
                      ) : null}
                    </div>
                    <div className={styles.assetsItemMeta}>
                      <div className={styles.assetsItemName} title={displayName}>
                        {displayName}
                      </div>
                      <div className={styles.assetsItemDetails}>
                        {asset.width}×{asset.height} · {asset.mimeType}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className={styles.questAssetsDetails}>
          {selectedAsset && draft ? (
            <>
              <div className={styles.questAssetsPreview}>
                <div className={styles.questAssetsPreviewFrame}>
                  {thumbUrls[selectedAsset.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbUrls[selectedAsset.id]}
                      alt={formatIconLabel(selectedAsset)}
                      style={{
                        transform: `scale(${previewScale.scaleX}, ${previewScale.scaleY})`,
                      }}
                    />
                  ) : null}
                </div>
              </div>
              <div className={styles.questAssetsFields}>
                <label className="form-label">Display Name</label>
                <input
                  className="form-control form-control-sm"
                  type="text"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((prev) =>
                      prev ? { ...prev, name: event.target.value } : prev,
                    )
                  }
                />
                <label className="form-label">Category</label>
                <input
                  className="form-control form-control-sm"
                  type="text"
                  value={selectedAsset.category ?? "Uncategorized"}
                  readOnly
                />
                {isIconAsset ? (
                  <>
                    <label className="form-label">Icon Type</label>
                    <input
                      className="form-control form-control-sm"
                      type="text"
                      list="quest-icon-types"
                      value={draft.iconType}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev ? { ...prev, iconType: event.target.value } : prev,
                        )
                      }
                      placeholder="e.g. Monster"
                    />
                    <label className="form-label">Icon Name</label>
                    <input
                      className="form-control form-control-sm"
                      type="text"
                      value={draft.iconName}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev ? { ...prev, iconName: event.target.value } : prev,
                        )
                      }
                      placeholder="e.g. Goblin"
                    />
                  </>
                ) : null}
                <label className="form-label">Grid Size (W × H)</label>
                <div className={styles.questAssetsRatioRow}>
                  <input
                    className="form-control form-control-sm"
                    type="number"
                    min="1"
                    step="1"
                    value={draft.gridW}
                    onChange={(event) =>
                      setDraft((prev) =>
                        prev ? { ...prev, gridW: event.target.value } : prev,
                      )
                    }
                  />
                  <span className={styles.questAssetsRatioSeparator}>×</span>
                  <input
                    className="form-control form-control-sm"
                    type="number"
                    min="1"
                    step="1"
                    value={draft.gridH}
                    onChange={(event) =>
                      setDraft((prev) =>
                        prev ? { ...prev, gridH: event.target.value } : prev,
                      )
                    }
                  />
                </div>
                <label className="form-label">Padding (% of cell)</label>
                <input
                  className="form-control form-control-sm"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={draft.paddingPct}
                  onChange={(event) =>
                    setDraft((prev) =>
                      prev ? { ...prev, paddingPct: event.target.value } : prev,
                    )
                  }
                />
              </div>
              <div className={styles.questAssetsActions}>
                <IconButton
                  className="btn btn-primary btn-sm"
                  icon={Save}
                  disabled={!isDirty || !isValid || isSaving}
                  onClick={handleSave}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </IconButton>
                <IconButton
                  className="btn btn-outline-danger btn-sm"
                  icon={Trash2}
                  disabled={isDeleting}
                  onClick={handleDelete}
                >
                  {isDeleting ? "Deleting..." : "Delete Asset"}
                </IconButton>
              </div>
            </>
          ) : (
            <div className={styles.questAssetsEmptyDetails}>
              Select an asset to edit its details.
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
