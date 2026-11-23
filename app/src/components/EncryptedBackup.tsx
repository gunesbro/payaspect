import type { EncryptedBackupData } from "@payaspect/core";
import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { useI18n } from "../i18n/I18nProvider";
import { useAppStore } from "../store/AppStore";
import { colors } from "../theme";
import {
  BackupCanceledError,
  BackupInvalidFileError,
  BackupPassphraseError,
  applyEncryptedBackup,
  createEncryptedBackup,
  readEncryptedBackup,
} from "../utils/encryptedBackup";
import {
  Card,
  DangerButton,
  Muted,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  TextField,
} from "./ui";

/**
 * Passphrase-protected full backup. The passphrase is entered once per action
 * and immediately discarded; restore requires an explicit destructive
 * confirmation and only writes after the decrypted payload is validated.
 */
export function EncryptedBackup() {
  const { t } = useI18n();
  const { reloadSilently } = useAppStore();
  const [passphrase, setPassphrase] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<EncryptedBackupData | null>(null);

  function messageFor(cause: unknown): string {
    if (cause instanceof BackupPassphraseError) return t("backup.shortPassphrase");
    if (cause instanceof BackupInvalidFileError) return t("backup.invalid");
    if (cause instanceof BackupCanceledError) return t("backup.canceled");
    return t("backup.failed");
  }

  async function create() {
    setBusy(true);
    setStatus(null);
    try {
      const name = await createEncryptedBackup(passphrase);
      setStatus(t("backup.created", { name }));
    } catch (cause) {
      setStatus(messageFor(cause));
    } finally {
      setPassphrase("");
      setBusy(false);
    }
  }

  async function prepareRestore() {
    setBusy(true);
    setStatus(null);
    try {
      const data = await readEncryptedBackup(passphrase);
      // The passphrase is no longer needed once the payload is decrypted.
      setPassphrase("");
      setPendingRestore(data);
    } catch (cause) {
      setStatus(messageFor(cause));
      setPassphrase("");
    } finally {
      setBusy(false);
    }
  }

  async function confirmRestore() {
    if (!pendingRestore) return;
    setBusy(true);
    try {
      await applyEncryptedBackup(pendingRestore);
      await reloadSilently();
      setPendingRestore(null);
      setStatus(t("backup.restored"));
    } catch {
      setPendingRestore(null);
      setStatus(t("backup.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionTitle>{t("backup.title")}</SectionTitle>
      <Muted>{t("backup.body")}</Muted>
      <TextField
        label={t("backup.passphraseLabel")}
        value={passphrase}
        onChangeText={setPassphrase}
        placeholder={t("backup.passphrasePlaceholder")}
        secureTextEntry
        autoCapitalize="none"
      />
      <PrimaryButton label={t("backup.create")} onPress={() => void create()} disabled={busy} />
      <SecondaryButton
        label={t("backup.restore")}
        onPress={() => void prepareRestore()}
        disabled={busy}
      />
      {status ? <Muted>{status}</Muted> : null}

      <Modal
        visible={pendingRestore != null}
        animationType="slide"
        transparent
        onRequestClose={() => setPendingRestore(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <ScrollView>
              <Text style={styles.title}>{t("backup.restoreTitle")}</Text>
              <Muted>{t("backup.restoreWarning")}</Muted>
              <DangerButton
                label={t("backup.restoreConfirm")}
                onPress={() => void confirmRestore()}
                disabled={busy}
              />
              <SecondaryButton
                label={t("common.cancel")}
                onPress={() => setPendingRestore(null)}
                disabled={busy}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    maxHeight: "80%",
  },
  title: { color: colors.text, fontSize: 18, fontWeight: "600", marginBottom: 8 },
});
