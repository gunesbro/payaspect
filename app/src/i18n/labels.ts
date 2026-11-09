import type { Translator } from "@payaspect/core";

/** Resolve a stored category id to a display label. */
export function categoryLabel(
  categoryId: string | null | undefined,
  t: Translator,
): string {
  if (!categoryId) {
    return t("common.noData");
  }
  if (categoryId.startsWith("sys_")) {
    return t(`category.${categoryId.slice(4)}`);
  }
  return categoryId;
}
