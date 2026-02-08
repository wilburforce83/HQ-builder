"use client";

import { useMemo } from "react";

import ModalShell from "@/components/ModalShell";
import { formatIconLabel } from "@/lib/icon-assets";
import type { HeroToken } from "@/lib/play-session-engine";
import type { CardRecord } from "@/types/cards-db";
import styles from "@/app/play.module.css";

type AssetLike = {
  id: string;
  name: string;
  iconType?: string | null;
  iconName?: string | null;
};

type HeroSelectionModalProps = {
  isOpen: boolean;
  heroCards: CardRecord[];
  heroAssets: AssetLike[];
  heroTokens: HeroToken[];
  selectedCardId: string | null;
  selectedCard: CardRecord | null;
  selectedIconId: string;
  maxHeroes: number;
  onSelectCard: (cardId: string) => void;
  onSelectIcon: (assetId: string) => void;
  onPlaceHero: () => void;
  onStartQuest: () => void;
};

function getCardLabel(card: CardRecord) {
  return card.title || card.name || "Untitled Hero";
}

export default function HeroSelectionModal({
  isOpen,
  heroCards,
  heroAssets,
  heroTokens,
  selectedCardId,
  selectedCard,
  selectedIconId,
  maxHeroes,
  onSelectCard,
  onSelectIcon,
  onPlaceHero,
  onStartQuest,
}: HeroSelectionModalProps) {
  const heroCount = heroTokens.length;
  const canAddHero = Boolean(selectedCard && selectedIconId && heroCount < maxHeroes);

  const roster = useMemo(
    () => heroTokens.map((hero) => ({ id: hero.id, name: hero.name })),
    [heroTokens],
  );

  return (
    <ModalShell
      isOpen={isOpen}
      title="Choose Heroes"
      onClose={() => undefined}
      contentClassName={styles.heroModal}
      footer={
        <div className={styles.heroModalFooter}>
          <div className={styles.heroModalFooterText}>
            {heroCount} / {maxHeroes} heroes ready
          </div>
          <button type="button" onClick={onStartQuest} disabled={heroCount === 0}>
            Start Quest
          </button>
        </div>
      }
    >
      <div className={styles.heroModalBody}>
        <div className={styles.heroCardPane}>
          <div className={styles.heroPaneTitle}>Hero Cards</div>
          <div className={styles.heroCardsScroll}>
            {heroCards.length === 0 ? (
              <div className={styles.heroEmpty}>
                No hero cards found. Create a hero card first.
              </div>
            ) : (
              <div className={styles.heroCardsGrid}>
                {heroCards.map((card) => {
                  const label = getCardLabel(card);
                  const thumbUrl =
                    typeof window !== "undefined" && card.thumbnailBlob
                      ? URL.createObjectURL(card.thumbnailBlob)
                      : null;
                  const isSelected = card.id === selectedCardId;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      className={`${styles.heroCardItem} ${
                        isSelected ? styles.heroCardItemSelected : ""
                      }`}
                      onClick={() => onSelectCard(card.id)}
                    >
                      <div className={styles.heroCardThumb}>
                        {thumbUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumbUrl}
                            alt={label}
                            onLoad={() => {
                              URL.revokeObjectURL(thumbUrl);
                            }}
                          />
                        ) : (
                          <div className={styles.heroCardPlaceholder}>No preview</div>
                        )}
                      </div>
                      <div className={styles.heroCardLabel} title={label}>
                        {label}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className={styles.heroSelectionPane}>
          <div className={styles.heroPaneTitle}>Selection</div>
          {selectedCard ? (
            <div className={styles.heroSelectionCard}>
              <div className={styles.heroSelectionName}>{getCardLabel(selectedCard)}</div>
              <label className={styles.heroSelectionLabel}>
                Hero token
                <select
                  className={styles.heroSelectionSelect}
                  value={selectedIconId}
                  onChange={(event) => onSelectIcon(event.target.value)}
                >
                  <option value="">Select hero token</option>
                  {heroAssets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {formatIconLabel(asset)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className={styles.heroPrimaryButton}
                onClick={onPlaceHero}
                disabled={!canAddHero}
              >
                Add Hero
              </button>
              {heroCount >= maxHeroes ? (
                <div className={styles.heroSelectionNote}>
                  Maximum heroes reached.
                </div>
              ) : null}
              {heroAssets.length === 0 ? (
                <div className={styles.heroSelectionNote}>
                  No hero tokens available. Upload hero icons in Assets.
                </div>
              ) : null}
            </div>
          ) : (
            <div className={styles.heroEmpty}>Select a hero card to continue.</div>
          )}
          <div className={styles.heroRosterBlock}>
            <div className={styles.heroPaneTitle}>Party</div>
            {roster.length === 0 ? (
              <div className={styles.heroEmpty}>No heroes added yet.</div>
            ) : (
              <ul className={styles.heroRosterList}>
                {roster.map((hero) => (
                  <li key={hero.id} className={styles.heroRosterItem}>
                    {hero.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
