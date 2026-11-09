import { ScreenGate } from "../components/ScreenGate";
import { Card, EmptyText, ListRow, Screen, Title } from "../components/ui";
import { useI18n } from "../i18n/I18nProvider";
import { useAppStore } from "../store/AppStore";

export function AccountsScreen() {
  const { t } = useI18n();
  const { accounts } = useAppStore();

  return (
    <ScreenGate>
      <Screen>
        <Title>{t("nav.accounts")}</Title>
        <Card>
          {accounts.length > 0 ? (
            accounts.map((account) => (
              <ListRow
                key={account.id}
                title={account.name}
                subtitle={`${t(`account.type.${account.type}`)} · ${account.currency}`}
              />
            ))
          ) : (
            <EmptyText>{t("accounts.empty")}</EmptyText>
          )}
        </Card>
      </Screen>
    </ScreenGate>
  );
}
