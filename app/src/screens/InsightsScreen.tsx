import { StyleSheet, Text, View } from "react-native";
import {
  formatAmount,
  formatMonthShort,
  type CurrencyTrend,
  type Locale,
} from "@payaspect/core";
import { ScreenGate } from "../components/ScreenGate";
import {
  Amount,
  Card,
  EmptyText,
  ListRow,
  Muted,
  Screen,
  SectionTitle,
  Title,
} from "../components/ui";
import { categoryLabel } from "../i18n/labels";
import { useI18n } from "../i18n/I18nProvider";
import { useAppStore } from "../store/AppStore";
import { colors } from "../theme";
import { formatPercent, monthChange } from "../utils/insights";

const TREND_BAR_HEIGHT = 64;
const MERCHANT_LIMIT = 5;

function TrendBars({ entry, locale }: { entry: CurrencyTrend; locale: Locale }) {
  const max = entry.points.reduce((highest, point) => Math.max(highest, point.total), 0);

  return (
    <View style={styles.trend}>
      {entry.points.map((point) => {
        const height =
          max > 0 ? Math.max(3, Math.round((point.total / max) * TREND_BAR_HEIGHT)) : 3;
        const month = formatMonthShort(point.from, locale);
        const amount = formatAmount(point.total, entry.currency, locale);

        return (
          <View
            key={point.from}
            accessible
            accessibilityLabel={`${month} ${amount}`}
            style={styles.trendColumn}
          >
            <View style={[styles.trendBar, { height }]} />
            <Text style={styles.trendLabel}>{month}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function InsightsScreen() {
  const { t, locale } = useI18n();
  const { accounts, summary, trend } = useAppStore();

  const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
  const trendByCurrency = new Map(
    (trend?.byCurrency ?? []).map((entry) => [entry.currency, entry.points]),
  );

  return (
    <ScreenGate>
      <Screen>
        <Title>{t("nav.insights")}</Title>

        {trend && trend.byCurrency.length > 0 ? (
          <>
            <SectionTitle>{t("insights.trend")}</SectionTitle>
            {trend.byCurrency.map((entry) => (
              <Card key={entry.currency}>
                <SectionTitle>{entry.currency}</SectionTitle>
                <TrendBars entry={entry} locale={locale} />
              </Card>
            ))}
          </>
        ) : null}

        <SectionTitle>{t("insights.byCurrencyTitle")}</SectionTitle>
        {summary && summary.byCurrency.length > 0 ? (
          summary.byCurrency.map((currency) => {
            const change = monthChange(
              currency.total,
              trendByCurrency.get(currency.currency),
            );
            const comparison = change
              ? `${formatPercent(change.percent, locale, true)} ${t("insights.comparedToLastMonth")}`
              : null;

            return (
              <Card key={currency.currency}>
                <SectionTitle>{currency.currency}</SectionTitle>
                <Amount>{formatAmount(currency.total, currency.currency, locale)}</Amount>
                {comparison ? <Muted>{comparison}</Muted> : null}

                <Muted>{t("insights.topMerchants")}</Muted>
                {currency.byMerchant.length > 0 ? (
                  currency.byMerchant.slice(0, MERCHANT_LIMIT).map((row) => (
                    <ListRow
                      key={row.merchant}
                      title={row.merchant}
                      value={formatAmount(row.total, currency.currency, locale)}
                    />
                  ))
                ) : (
                  <EmptyText>{t("insights.noData")}</EmptyText>
                )}

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
            );
          })
        ) : (
          <Card>
            <EmptyText>{t("insights.noSpending")}</EmptyText>
          </Card>
        )}
      </Screen>
    </ScreenGate>
  );
}

const styles = StyleSheet.create({
  trend: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 6,
    paddingTop: 8,
  },
  trendColumn: { flex: 1, alignItems: "center", gap: 4 },
  trendBar: {
    width: "100%",
    maxWidth: 28,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  trendLabel: { fontSize: 11, color: colors.muted },
});
