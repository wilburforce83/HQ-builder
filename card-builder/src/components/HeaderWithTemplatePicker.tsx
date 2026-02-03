"use client";

import { useRef, useState } from "react";

import AssetsModal from "@/components/Assets/AssetsModal";
import BackupProgressOverlay from "@/components/BackupProgressOverlay";
import { useCardEditor } from "@/components/CardEditor/CardEditorContext";
import ConfirmModal from "@/components/ConfirmModal";
import MainHeader from "@/components/MainHeader";
import StatLabelOverridesModal from "@/components/StatLabelOverridesModal";
import { StockpileModal } from "@/components/Stockpile";
import { useI18n } from "@/i18n/I18nProvider";
import { getTemplateNameLabel } from "@/i18n/messages";
import TemplatePicker from "@/components/TemplatePicker";
import { cardTemplatesById } from "@/data/card-templates";
import { usePopupState } from "@/hooks/usePopupState";
import { importBackupHqcc, importBackupJson } from "@/lib/backup";
import { getCard } from "@/lib/cards-db";
import type { TemplateId } from "@/types/templates";

export default function HeaderWithTemplatePicker() {
  const { t, language } = useI18n();
  const {
    state: { selectedTemplateId, activeCardIdByTemplate, isDirtyByTemplate },
    setSelectedTemplateId,
    loadCardIntoEditor,
  } = useCardEditor();

  const templatePicker = usePopupState(false);
  const assetsModal = usePopupState(false);
  const stockpileModal = usePopupState(false);
  const settingsModal = usePopupState(false);
  const [stockpileRefreshToken, setStockpileRefreshToken] = useState(0);
  const [pendingCard, setPendingCard] = useState<Awaited<ReturnType<typeof getCard>> | null>(null);
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [backupProgressCurrent, setBackupProgressCurrent] = useState(0);
  const [backupProgressTotal, setBackupProgressTotal] = useState(0);
  const [backupProgressStatus, setBackupProgressStatus] = useState<string | null>(null);
  const [backupSecondaryLabel, setBackupSecondaryLabel] = useState<string | null>(null);
  const [backupSecondaryPercent, setBackupSecondaryPercent] = useState<number | null>(null);
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedTemplate = selectedTemplateId ? cardTemplatesById[selectedTemplateId] : undefined;
  const currentTemplateName = selectedTemplate
    ? getTemplateNameLabel(language, selectedTemplate)
    : undefined;
  const currentTemplateId = selectedTemplateId ?? null;
  const activeCardId =
    currentTemplateId != null ? activeCardIdByTemplate[currentTemplateId] : undefined;

  const handleLoadCard = async (card: Awaited<ReturnType<typeof getCard>> | null) => {
    if (!card) return;
    try {
      const fresh = await getCard(card.id);
      const record = fresh ?? card;
      setSelectedTemplateId(record.templateId as TemplateId);
      loadCardIntoEditor(record.templateId as TemplateId, record);
      setStockpileRefreshToken((prev) => prev + 1);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[HeaderWithTemplatePicker] Failed to load card", error);
    }
  };

  const resolveImportErrorMessage = (message: string) => {
    switch (message) {
      case "Invalid data URL: missing data: prefix":
        return t("alert.invalidDataUrlPrefix");
      case "Invalid data URL: missing comma separator":
        return t("alert.invalidDataUrlSeparator");
      case "Invalid data URL: failed to decode payload":
        return t("alert.invalidDataUrlDecode");
      case "Invalid backup file structure":
        return t("alert.invalidBackupStructure");
      case "Invalid backup file: missing localStorage section":
        return t("alert.invalidBackupMissingLocalStorage");
      case "Could not read the selected backup file":
        return t("alert.couldNotReadBackupFile");
      case "Could not read backup data from this file":
        return t("alert.couldNotReadBackupData");
      default:
        return message;
    }
  };

  const handleImportClick = () => {
    if (isImporting) return;
    setIsImportConfirmOpen(true);
  };

  const handleImportConfirm = () => {
    setIsImportConfirmOpen(false);
    const input = fileInputRef.current;
    if (input) {
      input.value = "";
      input.click();
    }
  };

  const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setBackupProgressCurrent(0);
    setBackupProgressTotal(0);
    setBackupProgressStatus(t("status.preparing"));
    setBackupSecondaryLabel(t("status.preparing"));
    setBackupSecondaryPercent(null);
    try {
      const lowerName = file.name.toLowerCase();
      const useZip = lowerName.endsWith(".hqcc");
      const useJson = !useZip && lowerName.endsWith(".hqcc.json");

      const result = useZip
        ? await importBackupHqcc(file, {
            onProgress: (current, total) => {
              setBackupProgressCurrent(current);
              setBackupProgressTotal(total);
              setBackupProgressStatus(t("status.importingData"));
              setBackupSecondaryLabel(null);
              setBackupSecondaryPercent(null);
            },
            onStatus: (phase) => {
              setBackupProgressStatus(
                phase === "processing" ? t("status.importingData") : t("status.preparing"),
              );
              if (phase === "processing") {
                setBackupSecondaryLabel(null);
                setBackupSecondaryPercent(null);
              } else {
                setBackupSecondaryLabel(t("status.preparing"));
                setBackupSecondaryPercent(null);
              }
            },
          })
        : useJson
          ? await importBackupJson(file, {
              onProgress: (current, total) => {
                setBackupProgressCurrent(current);
                setBackupProgressTotal(total);
                setBackupProgressStatus(t("status.importingData"));
                setBackupSecondaryLabel(null);
                setBackupSecondaryPercent(null);
              },
              onStatus: (phase) => {
                setBackupProgressStatus(
                  phase === "processing" ? t("status.importingData") : t("status.preparing"),
                );
                if (phase === "processing") {
                  setBackupSecondaryLabel(null);
                  setBackupSecondaryPercent(null);
                } else {
                  setBackupSecondaryLabel(t("status.preparing"));
                  setBackupSecondaryPercent(null);
                }
              },
            })
          : await (async () => {
              throw new Error(t("alert.unsupportedBackupFile"));
            })();

      await new Promise((resolve) => setTimeout(resolve, 250));
      window.alert(
        `${t("alert.importComplete")}\n${t("label.cards")}: ${result.cardsCount}\n${t(
          "label.assets",
        )}: ${result.assetsCount}\n${t("label.collections")}: ${result.collectionsCount}`,
      );
      window.location.reload();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[HeaderWithTemplatePicker] Failed to import backup", error);
      window.alert(
        error instanceof Error ? resolveImportErrorMessage(error.message) : t("alert.importFailed"),
      );
    } finally {
      setIsImporting(false);
      setBackupProgressStatus(null);
      setBackupSecondaryLabel(null);
      setBackupSecondaryPercent(null);
    }
  };

  return (
    <>
      <MainHeader
        hasTemplate={Boolean(selectedTemplateId)}
        currentTemplateName={currentTemplateName}
        onOpenTemplatePicker={() => {
          if (!selectedTemplateId) return;
          templatePicker.open();
        }}
        onOpenAssets={assetsModal.open}
        onOpenStockpile={stockpileModal.open}
        onOpenSettings={settingsModal.open}
        onImportData={handleImportClick}
        isImporting={isImporting}
      />
      <TemplatePicker
        isOpen={templatePicker.isOpen}
        currentTemplateId={selectedTemplateId}
        onApply={(templateId) => {
          setSelectedTemplateId(templateId as TemplateId | null);
        }}
        onClose={templatePicker.close}
      />
      <AssetsModal isOpen={assetsModal.isOpen} onClose={assetsModal.close} mode="manage" />
      <StatLabelOverridesModal
        isOpen={settingsModal.isOpen}
        onClose={settingsModal.close}
      />
      <StockpileModal
        isOpen={stockpileModal.isOpen}
        onClose={stockpileModal.close}
        refreshToken={stockpileRefreshToken}
        activeCardId={activeCardId ?? null}
        onLoadCard={async (card) => {
          const currentTemplate = selectedTemplateId;
          const dirty =
            currentTemplate != null && Boolean(isDirtyByTemplate[currentTemplate as TemplateId]);
          if (dirty) {
            setPendingCard(card);
            setIsDiscardConfirmOpen(true);
            return;
          }
          await handleLoadCard(card);
        }}
      />
      <ConfirmModal
        isOpen={isDiscardConfirmOpen}
        title={t("heading.discardChanges")}
        confirmLabel={t("actions.discard")}
        cancelLabel={t("actions.cancel")}
        onConfirm={async () => {
          setIsDiscardConfirmOpen(false);
          const card = pendingCard;
          setPendingCard(null);
          await handleLoadCard(card);
        }}
        onCancel={() => {
          setIsDiscardConfirmOpen(false);
          setPendingCard(null);
        }}
      >
        {t("confirm.discardChangesBody")}
      </ConfirmModal>
      <input
        ref={fileInputRef}
        type="file"
        accept=".hqcc,.hqcc.json,application/zip,application/json"
        style={{ display: "none" }}
        onChange={handleImportFileChange}
      />
      <BackupProgressOverlay
        isOpen={Boolean(isImporting)}
        title={t("status.importingData")}
        statusLabel={backupProgressStatus}
        secondaryLabel={backupSecondaryLabel}
        secondaryPercent={backupSecondaryPercent}
        current={backupProgressCurrent}
        total={backupProgressTotal}
      />
      <ConfirmModal
        isOpen={isImportConfirmOpen}
        title={t("heading.importData")}
        confirmLabel={t("actions.import")}
        cancelLabel={t("actions.cancel")}
        onConfirm={handleImportConfirm}
        onCancel={() => setIsImportConfirmOpen(false)}
      >
        {t("confirm.importReplaceData")}
      </ConfirmModal>
    </>
  );
}
