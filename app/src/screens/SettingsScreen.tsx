import { AVAILABLE_LOCALES, type Locale } from "@payaspect/core";
import Constants from "expo-constants";
import { View } from "react-native";
import { ScreenGate } from "../components/ScreenGate";
import {
  Card,
  Chip,
  ListRow,
  Muted,
  PrimaryButton,
  Screen,
  SectionTitle,
  Title,
} from "../components/ui";
import { useI18n } from "../i18n/I18nProvider";
import { useAppStore } from "../store/AppStore";

/** Language names are shown in their own language, not translated. */
const LANGUAGE_LABELS: Record<Locale, string> = {
  en: "English",
  tr: "Türkçe",
};

export function SettingsScreen() {
  const { t, locale, setLocale } = useI18n();
  const { seedSampleData } = useAppStore();

  const version = Constants.expoConfig?.version ?? "0.1.0";

  return (
    <ScreenGate>
      <Screen>
        <Title>{t("nav.settings")}</Title>

        <Card>
          <SectionTitle>{t("settings.language")}</SectionTitle>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {AVAILABLE_LOCALES.map((available) => (
              <Chip
                key={available}
                label={LANGUAGE_LABELS[available]}
                active={available === locale}
                onPress={() => setLocale(available)}
              />
            ))}
          </View>
        </Card>

        <Card>
          <SectionTitle>{t("settings.data")}</SectionTitle>
          <PrimaryButton label={t("dev.seedSampleData")} onPress={() => void seedSampleData()} />
        </Card>

        <Card>
          <SectionTitle>{t("settings.privacy")}</SectionTitle>
          <Muted>{t("settings.privacyBody")}</Muted>
        </Card>

        <Card>
          <ListRow title={t("settings.version")} value={version} />
        </Card>
      </Screen>
    </ScreenGate>
  );
}
