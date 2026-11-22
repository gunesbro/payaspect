import { useState } from "react";
import {
  Card,
  Muted,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
} from "../components/ui";
import { useI18n } from "../i18n/I18nProvider";
import { createExport, type ExportFormat } from "../utils/exportFile";

/** Export all on-device data as CSV or JSON; no account or network required. */
export function DataExport() {
  const { t } = useI18n();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(format: ExportFormat) {
    setBusy(true);
    setStatus(null);
    try {
      const name = await createExport(format);
      setStatus(t("export.saved", { name }));
    } catch {
      setStatus(t("export.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionTitle>{t("export.title")}</SectionTitle>
      <Muted>{t("export.body")}</Muted>
      <PrimaryButton
        label={t("export.csv")}
        onPress={() => void run("csv")}
        disabled={busy}
      />
      <SecondaryButton
        label={t("export.json")}
        onPress={() => void run("json")}
        disabled={busy}
      />
      {status ? <Muted>{status}</Muted> : null}
    </Card>
  );
}
