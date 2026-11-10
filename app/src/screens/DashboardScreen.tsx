import { formatAmount, formatDate, type Locale, type Transaction } from "@payaspect/core";
import { ScreenGate } from "../components/ScreenGate";
import { SpendingNarrative } from "../components/SpendingNarrative";
import {
  Amount,
  Card,
  EmptyText,
  ListRow,
  Muted,
  PrimaryButton,
  Screen,
  SectionTitle,
  Title,
} from "../components/ui";
import { useI18n } from "../i18n/I18nProvider";
import { useAppStore } from "../store/AppStore";

function transactionAmount(tx: Transaction, locale: Locale): string {
  const value = tx.type === "expense" ? -tx.amount : tx.amount;
  return formatAmount(value, tx.currency, locale);
}

export function DashboardScreen() {
  const { t, locale } = useI18n();
  const { accounts, transactions, summary, trend, range, refresh } = useAppStore();

  const rangeLabel = `${formatDate(range.from, locale)} – ${formatDate(range.to, locale)}`;
  const recent = transactions
    .filter((tx) => tx.date >= range.from && tx.date <= range.to)
    .slice(0, 5);

  return (
    <ScreenGate>
      <Screen>
        <Title>{t("app.name")}</Title>
        <Muted>
          {t("insights.thisMonth")} · {rangeLabel}
        </Muted>

        <Card>
          {summary && summary.byCurrency.length > 0 ? (
            summary.total != null && summary.currency ? (
              <>
                <SectionTitle>{t("insights.total")}</SectionTitle>
                <Amount>{formatAmount(summary.total, summary.currency, locale)}</Amount>
              </>
            ) : (
              summary.byCurrency.map((currency) => (
                <ListRow
                  key={currency.currency}
                  title={currency.currency}
                  value={formatAmount(currency.total, currency.currency, locale)}
                />
              ))
            )
          ) : (
            <EmptyText>{t("insights.noSpending")}</EmptyText>
          )}
        </Card>

        {summary ? <SpendingNarrative summary={summary} trend={trend} /> : null}

        <Muted>{t("accounts.count", { count: accounts.length })}</Muted>

        <SectionTitle>{t("tx.recent")}</SectionTitle>
        <Card>
          {recent.length > 0 ? (
            recent.map((tx) => (
              <ListRow
                key={tx.id}
                title={tx.merchant ?? t(`tx.type.${tx.type}`)}
                subtitle={`${formatDate(tx.date, locale)} · ${t(`tx.type.${tx.type}`)}${
                  tx.isRecurring ? ` · ${t("tx.recurring")}` : ""
                }`}
                value={transactionAmount(tx, locale)}
              />
            ))
          ) : (
            <EmptyText>{t("tx.empty")}</EmptyText>
          )}
        </Card>

        <PrimaryButton label={t("common.refresh")} onPress={() => void refresh()} />
      </Screen>
    </ScreenGate>
  );
}
