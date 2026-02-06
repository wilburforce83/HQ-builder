"use client";

import { ArrowLeft, Images, LayoutTemplate, Settings, SquareStack, Upload } from "lucide-react";
import Image from "next/image";

import styles from "@/app/page.module.css";
import IconButton from "@/components/IconButton";
import { useI18n } from "@/i18n/I18nProvider";


type MainHeaderProps = {
  hasTemplate: boolean;
  currentTemplateName?: string;
  onOpenTemplatePicker: () => void;
  onOpenAssets: () => void;
  onOpenStockpile: () => void;
  onOpenSettings: () => void;
  onImportData: () => void;
  isImporting: boolean;
};

export default function MainHeader({
  hasTemplate,
  currentTemplateName,
  onOpenTemplatePicker,
  onOpenAssets,
  onOpenStockpile,
  onOpenSettings,
  onImportData,
  isImporting,
}: MainHeaderProps) {
  const { t } = useI18n();

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <div className={styles.headerTitleRow}>
          <Image
            src="/static/img/ui/logo.png"
            alt="Quest Builder"
            className={styles.headerLogo}
            width={32}
            height={32}
            priority
          />
          <span>Card Creator</span>
        </div>
      </div>
      <div className={styles.headerRight}>
        <IconButton
          className="btn btn-outline-light btn-sm"
          icon={LayoutTemplate}
          disabled={!hasTemplate}
          onClick={onOpenTemplatePicker}
          title={t("tooltip.chooseTemplate")}
        >
          {t("actions.template")}: {currentTemplateName ?? t("ui.loading")}
        </IconButton>
        <IconButton
          className="btn btn-outline-light btn-sm"
          icon={Images}
          onClick={onOpenAssets}
          title={t("tooltip.openAssets")}
        >
          {t("actions.assets")}
        </IconButton>
        <IconButton
          className="btn btn-outline-light btn-sm"
          icon={SquareStack}
          onClick={onOpenStockpile}
          title={t("tooltip.openCards")}
        >
          {t("actions.cards")}
        </IconButton>
        <IconButton
          className="btn btn-outline-light btn-sm"
          icon={Settings}
          onClick={onOpenSettings}
          title={t("tooltip.openSettings")}
        >
          {t("actions.settings")}
        </IconButton>
        <IconButton
          className="btn btn-outline-light btn-sm"
          icon={Upload}
          onClick={onImportData}
          disabled={isImporting}
          title={t("tooltip.importBackup")}
        >
          {isImporting ? t("actions.importing") : t("actions.importData")}
        </IconButton>
        <a href="/" className={`btn btn-outline-light btn-sm ${styles.headerNavLink}`}>
          <ArrowLeft className={styles.icon} aria-hidden="true" />
          Quest Builder
        </a>
      </div>
    </header>
  );
}
