"use client";

import { FolderOpen, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import styles from "@/app/page.module.css";
import IconButton from "@/components/IconButton";
import ModalShell from "@/components/ModalShell";

type QuestSummaryBase = {
  id: string;
  title?: string | null;
  campaign?: string | null;
  author?: string | null;
  updatedAt?: number | null;
  createdAt?: number | null;
};

type SavedQuestsModalProps<TQuest extends QuestSummaryBase> = {
  isOpen: boolean;
  onClose: () => void;
  quests: TQuest[];
  currentQuestId?: string | null;
  onLoadQuest: (quest: TQuest) => void;
  onDeleteQuest: (id: string) => Promise<void> | void;
};

function formatTimestamp(value?: number | null) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SavedQuestsModal<TQuest extends QuestSummaryBase>({
  isOpen,
  onClose,
  quests,
  currentQuestId,
  onLoadQuest,
  onDeleteQuest,
}: SavedQuestsModalProps<TQuest>) {
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return quests;
    return quests.filter((quest) => {
      const title = quest.title?.toLowerCase() ?? "";
      const campaign = quest.campaign?.toLowerCase() ?? "";
      const author = quest.author?.toLowerCase() ?? "";
      return (
        title.includes(term) ||
        campaign.includes(term) ||
        author.includes(term) ||
        quest.id.toLowerCase().includes(term)
      );
    });
  }, [quests, query]);

  const handleDelete = async (quest: TQuest) => {
    const label = quest.title?.trim() || "Untitled Quest";
    if (!window.confirm(`Delete \"${label}\"? This cannot be undone.`)) return;
    setDeletingId(quest.id);
    try {
      await onDeleteQuest(quest.id);
    } finally {
      setDeletingId((current) => (current === quest.id ? null : current));
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Saved Quests"
      contentClassName={styles.savedQuestsPopover}
    >
      <div className={styles.savedQuestsToolbar}>
        <div className="input-group input-group-sm" style={{ maxWidth: 280 }}>
          <span className="input-group-text">
            <Search className={styles.icon} aria-hidden="true" />
          </span>
          <input
            type="search"
            placeholder="Search saved quests..."
            className={`form-control form-control-sm bg-white text-dark ${styles.savedQuestsSearch}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className={styles.savedQuestsCount}>
          {filtered.length} / {quests.length}
        </div>
      </div>
      <div className={styles.savedQuestsList}>
        {filtered.length === 0 ? (
          <div className={styles.savedQuestsEmpty}>No saved quests found.</div>
        ) : (
          filtered.map((quest) => {
            const title = quest.title?.trim() || "Untitled Quest";
            const campaign = quest.campaign?.trim();
            const updated = formatTimestamp(quest.updatedAt ?? quest.createdAt ?? null);
            const isActive = quest.id === currentQuestId;
            return (
              <div
                key={quest.id}
                className={`${styles.savedQuestsRow} ${isActive ? styles.savedQuestsRowActive : ""}`}
              >
                <div className={styles.savedQuestsMeta}>
                  <div className={styles.savedQuestsTitle} title={title}>
                    {title}
                  </div>
                  <div className={styles.savedQuestsSubtitle}>
                    {campaign ? `Campaign: ${campaign} · ` : ""}
                    Updated {updated}
                  </div>
                </div>
                <div className={styles.savedQuestsActions}>
                  <IconButton
                    className="btn btn-outline-secondary btn-sm"
                    icon={FolderOpen}
                    onClick={() => {
                      onLoadQuest(quest);
                      onClose();
                    }}
                  >
                    Load
                  </IconButton>
                  <IconButton
                    className="btn btn-outline-danger btn-sm"
                    icon={Trash2}
                    disabled={deletingId === quest.id}
                    onClick={() => {
                      void handleDelete(quest);
                    }}
                  >
                    {deletingId === quest.id ? "Deleting..." : "Delete"}
                  </IconButton>
                </div>
              </div>
            );
          })
        )}
      </div>
    </ModalShell>
  );
}
