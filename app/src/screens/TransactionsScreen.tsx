import { formatAmount, formatDate, type Locale, type Transaction } from "@payaspect/core";
import { ScreenGate } from "../components/ScreenGate";
import { Card, EmptyText, ListRow, Screen, Title } from "../components/ui";
import { useI18n } from "../i18n/I18nProvider";
import { useAppStore } from "../store/AppStore";

function transactionAmount(tx: Transaction, locale: Locale): string {
  const value = tx.type === "expense" ? -tx.amount : tx.amount;
  return formatAmount(value, tx.currency, locale);
}

export function TransactionsScreen() {
  const { t, locale } = useI18n();
  const { transactions } = useAppStore();

  return (
    <ScreenGate>
      <Screen>
        <Title>{t("nav.transactions")}</Title>
        <Card>
          {transactions.length > 0 ? (
            transactions.map((tx) => (
              <ListRow
                key={tx.id}
                title={tx.merchant ?? t(`tx.type.${tx.type}`)}
                subtitle={`${formatDate(tx.date, locale)} · ${t(`tx.type.${tx.type}`)}`}
                value={transactionAmount(tx, locale)}
              />
            ))
          ) : (
            <EmptyText>{t("tx.empty")}</EmptyText>
          )}
        </Card>
      </Screen>
    </ScreenGate>
  );
}
