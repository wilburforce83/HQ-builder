import Link from "next/link";

import styles from "./home.module.css";

export default function HomePage() {
  return (
    <main className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.brand}>
          <img className={styles.logo} src="/static/img/ui/logo.png" alt="HeroQuest" />
          <div>
            <p className={styles.kicker}>HeroQuest Toolkit</p>
            <h1 className={styles.title}>Choose Your Path</h1>
          </div>
        </div>
        <p className={styles.subtitle}>
          Jump into a quest, craft a new dungeon, or build custom cards for your campaign.
        </p>
      </div>
      <section className={styles.navGrid}>
        <Link href="/play" className={styles.navCard}>
          <span className={styles.navTitle}>Play Quest</span>
          <span className={styles.navMeta}>Run a session with fog-of-war and reveals.</span>
        </Link>
        <Link href="/quest-builder" className={styles.navCard}>
          <span className={styles.navTitle}>Quest Builder</span>
          <span className={styles.navMeta}>Design maps, place assets, and play test.</span>
        </Link>
        <Link href="/cards" className={styles.navCard}>
          <span className={styles.navTitle}>Card Builder</span>
          <span className={styles.navMeta}>Create custom HeroQuest-style cards.</span>
        </Link>
      </section>
    </main>
  );
}
