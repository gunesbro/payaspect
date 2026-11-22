import {
  formatAmount,
  type SpendingSummary,
  type SpendingTrend,
} from "@payaspect/core";
import { StyleSheet, Text } from "react-native";
import { useI18n } from "../i18n/I18nProvider";
import { categoryLabel } from "../i18n/labels";
import { colors } from "../theme";
import { formatPercent, monthChange } from "../utils/insights";
import { Card, SectionTitle } from "./ui";

interface SpendingNarrativeProps {
  summary: SpendingSummary;
  trend: SpendingTrend | null;
}

/**
 * Short, template-based sentences for the dashboard. Everything is derived
 * from the current-month summary and the already-loaded trend; no extra query.
 */
export function SpendingNarrative({ summary, trend }: SpendingNarrativeProps) {
  const { t, locale } = useI18n();

  const trendByCurrency = new Map(
    (trend?.byCurrency ?? []).map((entry) => [entry.currency, entry.points]),
  );

  const lines = summary.byCurrency.flatMap((currency) => {
    const result: string[] = [];
    const top = currency.byCategory[0];

    if (top && currency.total > 0) {
      const percent = Math.round((top.total / currency.total) * 100);
      result.push(
        t("insights.summaryTopCategory", {
          category: categoryLabel(top.categoryId, t),
          amount: formatAmount(top.total, currency.currency, locale),
          percent,
        }),
      );
    }

    const points = trendByCurrency.get(currency.currency);
    const change = monthChange(currency.total, points);
    if (change) {
      const percent = formatPercent(Math.abs(change.percent), locale);
      if (change.direction === "flat") {
        result.push(t("insights.summaryFlat"));
      } else {
        result.push(
          t(
            change.direction === "up" ? "insights.summaryUp" : "insights.summaryDown",
            { percent },
          ),
        );
      }
    } else if (points && points.length >= 2 && (points[points.length - 2]?.total ?? 0) === 0) {
      result.push(t("insights.summaryNoPrevious"));
    }

    return result;
  });

  if (lines.length === 0) return null;

  return (
    <Card>
      <SectionTitle>{t("insights.summaryTitle")}</SectionTitle>
      {lines.map((line, index) => (
        <Text key={`${index}-${line}`} style={styles.line}>
          {line}
        </Text>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  line: { color: colors.text, fontSize: 14, lineHeight: 20 },
});
