import type { Category } from "./types";

/**
 * System category keys (stable identifiers, used by the classifier).
 * Order is meaningful and must stay stable.
 */
export const SYSTEM_CATEGORY_KEYS = [
  "housing",
  "groceries",
  "dining",
  "transport",
  "digital_subscriptions",
  "health",
  "clothing_personal_care",
  "education",
  "entertainment_hobby",
  "debt_credit",
  "savings_investment",
  "insurance_tax",
  "other",
] as const;

export type SystemCategoryKey = (typeof SYSTEM_CATEGORY_KEYS)[number];

/**
 * Build the default set of system expense categories.
 * Names are i18n keys resolved in the UI layer; the core stores stable keys.
 */
export function defaultSystemCategories(): Category[] {
  return SYSTEM_CATEGORY_KEYS.map((key, index) => ({
    id: `sys_${key}`,
    key,
    name: `category.${key}`,
    parentId: null,
    type: "expense",
    isSystem: true,
    hidden: false,
    sort: index,
  }));
}

export function isSystemCategoryKey(value: string): value is SystemCategoryKey {
  return (SYSTEM_CATEGORY_KEYS as readonly string[]).includes(value);
}
