import type { ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme";

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
}

/** Safe-area aware screen container with consistent padding. */
export function Screen({ children, scroll = true }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={styles.body}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Amount({ children }: { children: ReactNode }) {
  return <Text style={styles.amount}>{children}</Text>;
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function EmptyText({ children }: { children: ReactNode }) {
  return <Text style={styles.empty}>{children}</Text>;
}

interface ListRowProps {
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
}

export function ListRow({ title, subtitle, value, onPress }: ListRowProps) {
  const content = (
    <>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {content}
    </Pressable>
  );
}

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

type ButtonVariant = "primary" | "secondary" | "danger";

function ActionButton({
  label,
  onPress,
  disabled = false,
  variant,
}: ActionButtonProps & { variant: ButtonVariant }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "secondary" && styles.buttonSecondary,
        variant === "danger" && styles.buttonDanger,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text
        style={[
          styles.buttonLabel,
          variant === "secondary" && styles.buttonLabelSecondary,
          variant === "danger" && styles.buttonLabelDanger,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function PrimaryButton(props: ActionButtonProps) {
  return <ActionButton {...props} variant="primary" />;
}

export function SecondaryButton(props: ActionButtonProps) {
  return <ActionButton {...props} variant="secondary" />;
}

export function DangerButton(props: ActionButtonProps) {
  return <ActionButton {...props} variant="danger" />;
}

interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: TextInputProps["keyboardType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
  multiline?: boolean;
  onBlur?: () => void;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize = "none",
  multiline = false,
  onBlur,
}: TextFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        onBlur={onBlur}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

interface ChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

export function Chip({ label, active, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  body: { padding: 20, gap: 12 },
  title: { fontSize: 24, fontWeight: "700", color: colors.text },
  amount: { fontSize: 28, fontWeight: "700", color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  muted: { color: colors.muted, fontSize: 13 },
  empty: { color: colors.muted, fontSize: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 6,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 14, fontWeight: "500", color: colors.text },
  rowSubtitle: { fontSize: 12, color: colors.muted },
  rowValue: { fontSize: 14, fontWeight: "600", color: colors.text },
  rowPressed: { opacity: 0.6 },
  button: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  buttonPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  buttonSecondary: { backgroundColor: colors.surface, borderColor: colors.border },
  buttonDanger: { backgroundColor: colors.surface, borderColor: colors.danger },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.5 },
  buttonLabel: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
  buttonLabelSecondary: { color: colors.text },
  buttonLabelDanger: { color: colors.danger },
  field: { gap: 4 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: colors.muted },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: "top" },
  chip: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  chipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chipLabel: { color: colors.muted, fontSize: 14, fontWeight: "500" },
  chipLabelActive: { color: colors.accent },
});
