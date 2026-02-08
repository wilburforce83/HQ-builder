"use client";

import { useEffect, useState } from "react";

import PlayQuestList, { type PlayQuestSummary } from "@/components/play/PlayQuestList";
import styles from "@/app/play.module.css";

type QuestRecord = PlayQuestSummary & {
  updatedAt?: number | null;
  createdAt?: number | null;
};

export default function PlayQuestPage() {
  const [quests, setQuests] = useState<QuestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    fetch("/api/quests")
      .then((res) => res.json())
      .then((data: QuestRecord[]) => {
        if (!active) return;
        setQuests(data ?? []);
      })
      .catch(() => {
        if (!active) return;
        setQuests([]);
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className={styles.playPage}>
      <header className={styles.playHeader}>
        <div>
          <p className={styles.playKicker}>Play Quest</p>
          <h1>Choose a Quest</h1>
        </div>
        <a className={styles.playHeaderLink} href="/">
          Home
        </a>
      </header>
      {isLoading ? (
        <div className={styles.playEmpty}>Loading quests...</div>
      ) : (
        <PlayQuestList quests={quests} />
      )}
    </main>
  );
}
