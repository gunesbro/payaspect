import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import {
  KeywordClassifier,
  SYSTEM_CATEGORY_KEYS,
  parseDate,
  validateTransaction,
  type Transaction,
  type TransactionType,
} from "@payaspect/core";
import * as Crypto from "expo-crypto";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ScreenGate } from "../components/ScreenGate";
import {
  Card,
  Chip,
  Muted,
  PrimaryButton,
  Screen,
  TextField,
  Title,
} from "../components/ui";
import { useI18n } from "../i18n/I18nProvider";
import type { RootTabParamList } from "../navigation/types";
import { useAppStore } from "../store/AppStore";
import { colors } from "../theme";
import { toDateInput } from "../utils/date";

const TRANSACTION_TYPES: readonly TransactionType[] = ["expense", "income", "transfer"];
const CURRENCIES = ["TRY", "USD", "EUR", "GBP"] as const;
const DEFAULT_CATEGORY = "sys_other";

function parseAmount(text: string): number | null {
  const normalized = text.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function AddScreen() {
  const { t } = useI18n();
  const { accounts, addTransaction } = useAppStore();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();

  const [type, setType] = useState<TransactionType>("expense");
  const [amountText, setAmountText] = useState("");
  const [currency, setCurrency] = useState(accounts[0]?.currency ?? "TRY");
  const [accountId, setAccountId] = useState<string | null>(accounts[0]?.id ?? null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState(DEFAULT_CATEGORY);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [dateText, setDateText] = useState(() => toDateInput(Date.now()));
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const classifier = useMemo(() => new KeywordClassifier(), []);
  useEffect(() => () => void classifier.dispose(), [classifier]);

  // Keep the selection valid if accounts are added after this screen mounts.
  useEffect(() => {
    if (accountId && accounts.some((account) => account.id === accountId)) return;
    const first = accounts[0];
    setAccountId(first?.id ?? null);
    if (first) setCurrency(first.currency);
  }, [accounts, accountId]);

  const currencies = useMemo(
    () => Array.from(new Set([...accounts.map((account) => account.currency), ...CURRENCIES])),
    [accounts],
  );
  const destinationAccounts = accounts.filter((account) => account.id !== accountId);

  function selectType(next: TransactionType) {
    setType(next);
    if (next !== "expense") {
      setCategoryId(DEFAULT_CATEGORY);
      setCategoryTouched(false);
    }
  }

  function selectAccount(id: string) {
    setAccountId(id);
    const account = accounts.find((candidate) => candidate.id === id);
    if (account) setCurrency(account.currency);
    if (toAccountId === id) setToAccountId(null);
  }

  async function suggestCategory() {
    if (type !== "expense" || categoryTouched) return;
    const suggestion = await classifier.classify({ merchant, note });
    if (suggestion.categoryId) setCategoryId(suggestion.categoryId);
  }

  async function handleSave() {
    if (saving) return;

    const amount = parseAmount(amountText);
    const date = parseDate(dateText);

    if (amount == null || date == null || !accountId) {
      setFormError(t("add.invalid"));
      return;
    }
    if (type === "transfer" && (!toAccountId || toAccountId === accountId)) {
      setFormError(t("add.invalid"));
      return;
    }

    const transaction: Transaction = {
      id: Crypto.randomUUID(),
      type,
      amount,
      currency,
      accountId,
      toAccountId: type === "transfer" ? toAccountId : null,
      categoryId: type === "transfer" ? null : categoryId,
      date,
      merchant: merchant.trim() || null,
      note: note.trim() || null,
      isRecurring: false,
      source: "manual",
      createdAt: Date.now(),
    };

    if (validateTransaction(transaction).length > 0) {
      setFormError(t("add.invalid"));
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await addTransaction(transaction);
      setAmountText("");
      setMerchant("");
      setNote("");
      setDateText(toDateInput(Date.now()));
      setCategoryId(DEFAULT_CATEGORY);
      setCategoryTouched(false);
      navigation.navigate("Transactions");
    } catch {
      setFormError(t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScreenGate>
      <Screen>
        <Title>{t("nav.add")}</Title>

        {accounts.length === 0 ? (
          <Card>
            <Muted>{t("add.noAccounts")}</Muted>
          </Card>
        ) : null}

        <Card>
          <View style={styles.wrap}>
            {TRANSACTION_TYPES.map((option) => (
              <Chip
                key={option}
                label={t(`tx.type.${option}`)}
                active={type === option}
                onPress={() => selectType(option)}
              />
            ))}
          </View>
        </Card>

        <Card>
          <TextField
            label={t("tx.amount")}
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />

          <Text style={styles.label}>{t("tx.currency")}</Text>
          <View style={styles.wrap}>
            {currencies.map((code) => (
              <Chip
                key={code}
                label={code}
                active={currency === code}
                onPress={() => setCurrency(code)}
              />
            ))}
          </View>

          <Text style={styles.label}>{t("tx.account")}</Text>
          <View style={styles.wrap}>
            {accounts.map((account) => (
              <Chip
                key={account.id}
                label={account.name}
                active={accountId === account.id}
                onPress={() => selectAccount(account.id)}
              />
            ))}
          </View>

          {type === "transfer" ? (
            <>
              <Text style={styles.label}>{t("add.toAccount")}</Text>
              {destinationAccounts.length > 0 ? (
                <View style={styles.wrap}>
                  {destinationAccounts.map((account) => (
                    <Chip
                      key={account.id}
                      label={account.name}
                      active={toAccountId === account.id}
                      onPress={() => setToAccountId(account.id)}
                    />
                  ))}
                </View>
              ) : (
                <Muted>{t("add.needTwoAccounts")}</Muted>
              )}
            </>
          ) : null}

          {type === "expense" ? (
            <>
              <Text style={styles.label}>{t("tx.category")}</Text>
              <View style={styles.wrap}>
                {SYSTEM_CATEGORY_KEYS.map((key) => (
                  <Chip
                    key={key}
                    label={t(`category.${key}`)}
                    active={categoryId === `sys_${key}`}
                    onPress={() => {
                      setCategoryId(`sys_${key}`);
                      setCategoryTouched(true);
                    }}
                  />
                ))}
              </View>
            </>
          ) : null}

          <TextField
            label={t("tx.date")}
            value={dateText}
            onChangeText={setDateText}
            placeholder={t("add.dateHint")}
          />
          <TextField
            label={t("tx.merchant")}
            value={merchant}
            onChangeText={setMerchant}
            autoCapitalize="words"
            onBlur={() => void suggestCategory()}
          />
          <TextField
            label={t("tx.note")}
            value={note}
            onChangeText={setNote}
            autoCapitalize="sentences"
            multiline
            onBlur={() => void suggestCategory()}
          />

          {formError ? <Text style={styles.error}>{formError}</Text> : null}

          <PrimaryButton
            label={t("add.save")}
            onPress={() => void handleSave()}
            disabled={saving || accounts.length === 0}
          />
        </Card>
      </Screen>
    </ScreenGate>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  label: { fontSize: 12, fontWeight: "600", color: colors.muted },
  error: { color: colors.danger, fontSize: 13 },
});
