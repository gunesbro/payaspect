import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { ParsedTransactionDraft } from "@payaspect/core";
import { useState } from "react";
import { ScreenGate } from "../components/ScreenGate";
import { TransactionForm } from "../components/TransactionForm";
import { Muted, PrimaryButton, Screen, Title } from "../components/ui";
import { useI18n } from "../i18n/I18nProvider";
import type { RootTabParamList } from "../navigation/types";
import { useAppStore } from "../store/AppStore";
import { scanReceipt } from "../utils/ocr";

export function AddScreen() {
  const { t } = useI18n();
  const { addTransaction } = useAppStore();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();

  const [draft, setDraft] = useState<ParsedTransactionDraft | null>(null);
  const [scanId, setScanId] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  async function scan() {
    if (scanning) return;
    setScanning(true);
    setStatus(null);
    try {
      const result = await scanReceipt();
      if (result.status === "denied") {
        setStatus(t("ocr.permissionDenied"));
      } else if (result.status === "cancelled") {
        setStatus(t("ocr.cancelled"));
      } else {
        const next = result.draft;
        setDraft(next);
        // Remount the form so the new suggestions become its initial values.
        setScanId((id) => id + 1);
        setStatus(
          next.amount == null && next.merchant == null && next.date == null
            ? t("ocr.noFields")
            : t("ocr.reviewSuggestions"),
        );
      }
    } catch {
      setStatus(t("ocr.failed"));
    } finally {
      setScanning(false);
    }
  }

  return (
    <ScreenGate>
      <Screen>
        <Title>{t("nav.add")}</Title>
        <PrimaryButton
          label={t("ocr.scanReceipt")}
          onPress={() => void scan()}
          disabled={scanning}
        />
        {status ? <Muted>{status}</Muted> : null}
        <TransactionForm
          key={scanId}
          draft={draft}
          source={draft ? "ocr" : "manual"}
          submitLabel={t("add.save")}
          onSubmit={addTransaction}
          onSaved={() => {
            setDraft(null);
            setStatus(null);
            navigation.navigate("Transactions");
          }}
        />
      </Screen>
    </ScreenGate>
  );
}
