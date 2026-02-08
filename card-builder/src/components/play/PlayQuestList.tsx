"use client";

import Link from "next/link";

import styles from "@/app/play.module.css";

export type PlayQuestSummary = {
  id: string;
  title?: string | null;
  campaign?: string | null;
  author?: string | null;
  thumbnailUrl?: string | null;
  updatedAt?: number | null;
};

type PlayQuestListProps = {
  quests: PlayQuestSummary[];
};

function formatDate(value?: number | null) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function PlayQuestList({ quests }: PlayQuestListProps) {
  if (quests.length === 0) {
    return <div className={styles.playEmpty}>No quests available.</div>;
  }

  return (
    <div className={styles.playGrid}>
      {quests.map((quest) => {
        const title = quest.title?.trim() || "Untitled Quest";
        return (
          <Link key={quest.id} href={`/play/${quest.id}`} className={styles.playCard}>
            <div className={styles.playThumbnail}>
              {quest.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={quest.thumbnailUrl} alt={title} />
              ) : (
                <span>No thumbnail</span>
              )}
            </div>
            <div className={styles.playMeta}>
              <h3>{title}</h3>
              <p>{quest.campaign ? `Campaign: ${quest.campaign}` : "Standalone Quest"}</p>
              <p className={styles.playDate}>Updated {formatDate(quest.updatedAt ?? undefined)}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
