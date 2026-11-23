import {
  ASKABLE_QUESTIONS,
  answerQuestion,
  type QuestionId,
} from "@payaspect/core";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useI18n } from "../i18n/I18nProvider";
import { useAppStore } from "../store/AppStore";
import { colors } from "../theme";
import { Card, Chip, Muted, SectionTitle } from "./ui";

/**
 * Fixed questions answered from the data already loaded in the store.
 * No model download, network call or extra database query is involved.
 */
export function QuestionAnswerPanel() {
  const { t, locale } = useI18n();
  const { summary, trend, budgets, accounts, categories } = useAppStore();
  const [selected, setSelected] = useState<QuestionId | null>(null);

  const question = ASKABLE_QUESTIONS.find((item) => item.id === selected);
  const answer = selected
    ? answerQuestion(
        selected,
        { summary, trend, budgets, accounts, categories, locale },
        t,
      )
    : null;

  return (
    <Card>
      <SectionTitle>{t("qa.title")}</SectionTitle>
      <View style={styles.chips}>
        {ASKABLE_QUESTIONS.map((item) => (
          <Chip
            key={item.id}
            label={t(item.labelKey)}
            active={selected === item.id}
            onPress={() => setSelected(item.id)}
          />
        ))}
      </View>
      {question && answer ? (
        <View style={styles.answer}>
          <Text style={styles.question}>{t(question.labelKey)}</Text>
          <Text style={styles.answerText}>{answer}</Text>
        </View>
      ) : (
        <Muted>{t("qa.prompt")}</Muted>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  answer: {
    gap: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  question: { color: colors.muted, fontSize: 13 },
  answerText: { color: colors.text, fontSize: 14, lineHeight: 20 },
});
