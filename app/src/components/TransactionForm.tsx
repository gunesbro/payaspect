import {
  KeywordClassifier,
  parseDate,
  validateTransaction,
  type ParsedTransactionDraft,
  type Transaction,
  type TransactionSource,
  type TransactionType,
} from "@payaspect/core";
import * as Crypto from "expo-crypto";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  Card,
  Chip,
  Muted,
  PrimaryButton,
  TextField,
} from "../components/ui";
import { useI18n } from "../i18n/I18nProvider";
import { categoryLabel } from "../i18n/labels";
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

interface TransactionFormProps {
  /** Existing transaction to edit; omitted when creating a new one. */
  initial?: Transaction | null;
  submitLabel: string;
  onSubmit: (transaction: Transaction) => Promise<void>;
  /** Called after a successful save, e.g. to navigate or close a modal. */
  onSaved: () => void;
  /** Optional extra buttons rendered under the submit button (e.g. delete). */
  extraActions?: ReactNode;
  /** On-device OCR suggestions used only when creating a new transaction. */
  draft?: ParsedTransactionDraft | null;
  /** How a newly created transaction was entered. */
  source?: TransactionSource;
}

/**
 * Shared create/edit form. It keeps all parsing and validation local so the
 * caller only receives a fully validated transaction ready for the encrypted
 * database. No network, no new dependencies.
 */
export function TransactionForm({
  initial = null,
  submitLabel,
  onSubmit,
  onSaved,
  extraActions,
  draft = null,
  source = "manual",
}: TransactionFormProps) {
  const { t } = useI18n();
  const { accounts, categories } = useAppStore();
  const editing = initial != null;
  const suggestion = editing ? null : draft;

  const visibleCategories = useMemo(
    () => categories.filter((category) => !category.hidden && category.type === "expense"),
    [categories],
  );
  const fallbackCategory =
    visibleCategories.find((category) => category.key === "other")?.id ??
    visibleCategories[0]?.id ??
    DEFAULT_CATEGORY;

  const [type, setType] = useState<TransactionType>(initial?.type ?? "expense");
  const [amountText, setAmountText] = useState(
    initial
      ? String(initial.amount)
      : suggestion?.amount != null
        ? String(suggestion.amount)
        : "",
  );
  const [currency, setCurrency] = useState(
    initial?.currency ?? suggestion?.currency ?? accounts[0]?.currency ?? "TRY",
  );
  const [accountId, setAccountId] = useState<string | null>(
    initial?.accountId ?? accounts[0]?.id ?? null,
  );
  const [toAccountId, setToAccountId] = useState<string | null>(
    initial?.toAccountId ?? null,
  );
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ?? fallbackCategory,
  );
  // Never let the classifier overwrite a category the user already saved.
  const [categoryTouched, setCategoryTouched] = useState(editing);
  const [dateText, setDateText] = useState(() =>
    toDateInput(initial?.date ?? suggestion?.date ?? Date.now()),
  );
  const [merchant, setMerchant] = useState(
    initial?.merchant ?? suggestion?.merchant ?? "",
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const classifier = useMemo(() => new KeywordClassifier(), []);
  useEffect(() => () => void classifier.dispose(), [classifier]);

  // Keep the selection valid if accounts are added after the form mounts.
  useEffect(() => {
    if (accountId && accounts.some((account) => account.id === accountId)) return;
    const first = accounts[0];
    setAccountId(first?.id ?? null);
    if (first) setCurrency(first.currency);
  }, [accounts, accountId]);

  const currencies = useMemo(
    () =>
      Array.from(
        new Set([
          ...(initial ? [initial.currency] : []),
          ...(suggestion?.currency ? [suggestion.currency] : []),
          ...accounts.map((account) => account.currency),
          ...CURRENCIES,
        ]),
      ),
    [accounts, initial, suggestion],
  );
  const destinationAccounts = accounts.filter((account) => account.id !== accountId);

  function selectType(next: TransactionType) {
    setType(next);
    if (next !== "expense") {
      setCategoryId(fallbackCategory);
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
    const suggestedId = suggestion.categoryId;
    if (
      suggestedId &&
      visibleCategories.some((category) => category.id === suggestedId)
    ) {
      setCategoryId(suggestedId);
    }
  }

  function resetForm() {
    setAmountText("");
    setMerchant("");
    setNote("");
    setDateText(toDateInput(Date.now()));
    setCategoryId(fallbackCategory);
    setCategoryTouched(false);
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
      id: initial?.id ?? Crypto.randomUUID(),
      type,
      amount,
      currency,
      accountId,
      toAccountId: type === "transfer" ? toAccountId : null,
      categoryId: type === "transfer" ? null : categoryId,
      date,
      merchant: merchant.trim() || null,
      note: note.trim() || null,
      isRecurring: initial?.isRecurring ?? false,
      source: initial?.source ?? source,
      createdAt: initial?.createdAt ?? Date.now(),
    };

    if (validateTransaction(transaction).length > 0) {
      setFormError(t("add.invalid"));
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await onSubmit(transaction);
      if (!editing) resetForm();
      onSaved();
    } catch {
      setFormError(t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
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
              {visibleCategories.map((category) => (
                <Chip
                  key={category.id}
                  label={categoryLabel(category.id, t, categories)}
                  active={categoryId === category.id}
                  onPress={() => {
                    setCategoryId(category.id);
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
          label={submitLabel}
          onPress={() => void handleSave()}
          disabled={saving || accounts.length === 0}
        />
        {extraActions}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  label: { fontSize: 12, fontWeight: "600", color: colors.muted },
  error: { color: colors.danger, fontSize: 13 },
});
