import { ScreenGate } from "../components/ScreenGate";
import { Card, Muted, Screen, SectionTitle, Title } from "../components/ui";
import { useI18n } from "../i18n/I18nProvider";

export function AddScreen() {
  const { t } = useI18n();

  return (
    <ScreenGate>
      <Screen>
        <Title>{t("nav.add")}</Title>
        <Card>
          <SectionTitle>{t("nav.add")}</SectionTitle>
          <Muted>{t("add.body")}</Muted>
          <Muted>{t("common.comingSoon")}</Muted>
        </Card>
      </Screen>
    </ScreenGate>
  );
}
