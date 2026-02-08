"use client";

import { useEffect, useState } from "react";

import PlaySessionView, { type PlaySessionQuest } from "@/components/play/PlaySessionView";
import styles from "@/app/play.module.css";

type AssetRecord = {
  id: string;
  name: string;
  iconType?: string | null;
  iconName?: string | null;
};

export default function PlaySessionPage({ params }: { params: { id: string } }) {
  const [quest, setQuest] = useState<PlaySessionQuest | null>(null);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    Promise.all([
      fetch(`/api/quests/${params.id}`).then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("Quest not found")),
      ),
      fetch("/api/assets").then((res) => res.json()),
    ])
      .then(([questData, assetData]) => {
        if (!active) return;
        setQuest(questData as PlaySessionQuest);
        setAssets(assetData as AssetRecord[]);
      })
      .catch(() => {
        if (!active) return;
        setQuest(null);
        setAssets([]);
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [params.id]);

  if (isLoading) {
    return (
      <main className={styles.playPage}>
        <div className={styles.playEmpty}>Loading play session...</div>
      </main>
    );
  }

  if (!quest) {
    return (
      <main className={styles.playPage}>
        <div className={styles.playEmpty}>Quest not found.</div>
        <a href="/play" className={styles.playHeaderLink}>
          Back to quests
        </a>
      </main>
    );
  }

  return (
    <main className={styles.sessionPage}>
      <PlaySessionView
        quest={quest}
        assets={assets}
        storageKey={`play-session:${quest.id}`}
        variant="page"
      />
    </main>
  );
}
