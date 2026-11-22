import type { Category, Translator } from "@payaspect/core";

/**
 * Resolve a stored category id to a display label.
 * When categories are supplied, the stored name wins so custom categories and
 * user-renamed system categories render correctly.
 */
export function categoryLabel(
  categoryId: string | null | undefined,
  t: Translator,
  categories?: ReadonlyArray<Category>,
): string {
  if (!categoryId) {
    return t("common.noData");
  }

  const stored = categories?.find((category) => category.id === categoryId);
  if (stored) {
    return stored.name.startsWith("category.") ? t(stored.name) : stored.name;
  }

  if (categoryId.startsWith("sys_")) {
    return t(`category.${categoryId.slice(4)}`);
  }
  return categoryId;
}
