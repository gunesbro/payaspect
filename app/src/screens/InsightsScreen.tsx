import { formatAmount } from "@payaspect/core";
import { ScreenGate } from "../components/ScreenGate";
import { Card, EmptyText, ListRow, Muted, Screen, SectionTitle, Title } from "../components/ui";
import { categoryLabel } from "../i18n/labels";
import { useI18n } from "../i18n/I18nProvider";
import { useAppStore } from "../store/AppStore";

export function InsightsScreen() {
  const { t, locale } = useI18n();
  const { accounts, summary } = useAppStore();

  const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
  const hasSpending = summary != null && summary.byCurrency.length > 0;

  return (
    <ScreenGate>
      <Screen>
        <Title>{t("nav.insights")}</Title>

        {hasSpending ? (
          summary.byCurrency.map((currency) => (
            <Card key={currency.currency}>
              <SectionTitle>{currency.currency}</SectionTitle>
              <Muted>{formatAmount(currency.total, currency.currency, locale)}</Muted>

              <Muted>{t("insights.byCategory")}</Muted>
              {currency.byCategory.length > 0 ? (
                currency.byCategory.map((row) => (
                  <ListRow
                    key={row.categoryId ?? "none"}
                    title={categoryLabel(row.categoryId, t)}
                    value={formatAmount(row.total, currency.currency, locale)}
                  />
                ))
              ) : (
                <EmptyText>{t("insights.noData")}</EmptyText>
              )}

              <Muted>{t("insights.byAccount")}</Muted>
              {currency.byAccount.length > 0 ? (
                currency.byAccount.map((row) => (
                  <ListRow
                    key={row.accountId}
                    title={accountNames.get(row.accountId) ?? row.accountId}
                    value={formatAmount(row.total, currency.currency, locale)}
                  />
                ))
              ) : (
                <EmptyText>{t("insights.noData")}</EmptyText>
              )}
            </Card>
          ))
        ) : (
          <Card>
            <EmptyText>{t("insights.noSpending")}</EmptyText>
          </Card>
        )}
      </Screen>
    </ScreenGate>
  );
}
