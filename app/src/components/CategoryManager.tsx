import type { Category } from "@payaspect/core";
import * as Crypto from "expo-crypto";
import { useState } from "react";
import { Modal, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Card,
  Chip,
  ListRow,
  Muted,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  TextField,
  Title,
} from "../components/ui";
import { useI18n } from "../i18n/I18nProvider";
import { categoryLabel } from "../i18n/labels";
import { useAppStore } from "../store/AppStore";
import { colors } from "../theme";

/** Add, rename and hide categories. System keys stay stable for the classifier. */
export function CategoryManager() {
  const { t } = useI18n();
  const { categories, addCategory, updateCategory } = useAppStore();

  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEditor(category: Category | null) {
    setEditing(
      category ?? {
        id: `cat_${Crypto.randomUUID()}`,
        key: null,
        name: "",
        parentId: null,
        type: "expense",
        isSystem: false,
        hidden: false,
        sort: categories.length,
      },
    );
    setName(category?.isSystem ? "" : (category?.name ?? ""));
    setHidden(category?.hidden ?? false);
    setError(null);
  }

  function closeEditor() {
    setEditing(null);
    setError(null);
  }

  async function save() {
    if (!editing) return;

    const trimmed = name.trim();
    if (!editing.isSystem && !trimmed) {
      setError(t("categories.invalid"));
      return;
    }

    const next: Category = {
      ...editing,
      name: editing.isSystem ? editing.name : trimmed,
      hidden,
    };

    try {
      const exists = categories.some((category) => category.id === next.id);
      if (exists) {
        await updateCategory(next);
      } else {
        await addCategory(next);
      }
      closeEditor();
    } catch {
      setError(t("common.error"));
    }
  }

  return (
    <>
      <Card>
        <SectionTitle>{t("categories.title")}</SectionTitle>
        {categories.map((category) => (
          <ListRow
            key={category.id}
            title={categoryLabel(category.id, t, categories)}
            subtitle={category.hidden ? t("categories.hidden") : t("categories.visible")}
            onPress={() => openEditor(category)}
          />
        ))}
        <PrimaryButton label={t("categories.new")} onPress={() => openEditor(null)} />
      </Card>

      <Modal
        visible={editing != null}
        animationType="slide"
        onRequestClose={closeEditor}
      >
        <SafeAreaView style={styles.modal} edges={["top", "left", "right", "bottom"]}>
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Title>
              {editing?.isSystem
                ? categoryLabel(editing.id, t, categories)
                : editing
                  ? t("categories.edit")
                  : t("categories.new")}
            </Title>

            {editing?.isSystem ? (
              <Muted>{t("categories.systemNote")}</Muted>
            ) : (
              <TextField
                label={t("categories.name")}
                value={name}
                onChangeText={setName}
                autoCapitalize="sentences"
              />
            )}

            <View style={styles.chips}>
              <Chip
                label={t("categories.visible")}
                active={!hidden}
                onPress={() => setHidden(false)}
              />
              <Chip
                label={t("categories.hidden")}
                active={hidden}
                onPress={() => setHidden(true)}
              />
            </View>

            {error ? <Muted>{error}</Muted> : null}

            <PrimaryButton label={t("categories.save")} onPress={() => void save()} />
            <SecondaryButton label={t("common.cancel")} onPress={closeEditor} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: colors.background },
  modalBody: { padding: 20, gap: 12 },
  chips: { flexDirection: "row", gap: 8 },
});
