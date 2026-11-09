import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useI18n } from "../i18n/I18nProvider";
import { useAppStore } from "../store/AppStore";
import { colors } from "../theme";
import { Card, PrimaryButton, Screen } from "./ui";

/**
 * Renders a loading or error state for the whole screen while the store is
 * opening the database, otherwise renders the screen content.
 */
export function ScreenGate({ children }: { children: ReactNode }) {
  const { status, error, refresh } = useAppStore();
  const { t } = useI18n();

  if (status === "loading") {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.muted}>{t("common.loading")}</Text>
        </View>
      </Screen>
    );
  }

  if (status === "error") {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <Card>
            <Text style={styles.errorTitle}>{t("common.error")}</Text>
            <Text style={styles.muted}>{error}</Text>
            <PrimaryButton label={t("common.refresh")} onPress={() => void refresh()} />
          </Card>
        </View>
      </Screen>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", gap: 12 },
  muted: { color: colors.muted, fontSize: 14, textAlign: "center" },
  errorTitle: { color: colors.danger, fontSize: 15, fontWeight: "600" },
});
