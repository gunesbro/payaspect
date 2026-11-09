import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { ScreenGate } from "../components/ScreenGate";
import { TransactionForm } from "../components/TransactionForm";
import { Screen, Title } from "../components/ui";
import { useI18n } from "../i18n/I18nProvider";
import type { RootTabParamList } from "../navigation/types";
import { useAppStore } from "../store/AppStore";

export function AddScreen() {
  const { t } = useI18n();
  const { addTransaction } = useAppStore();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();

  return (
    <ScreenGate>
      <Screen>
        <Title>{t("nav.add")}</Title>
        <TransactionForm
          submitLabel={t("add.save")}
          onSubmit={addTransaction}
          onSaved={() => navigation.navigate("Transactions")}
        />
      </Screen>
    </ScreenGate>
  );
}
