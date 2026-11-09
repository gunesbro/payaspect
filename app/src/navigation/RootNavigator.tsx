import { Ionicons } from "@expo/vector-icons";
import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from "@react-navigation/bottom-tabs";
import type { ComponentProps } from "react";
import type { Translator } from "@payaspect/core";
import { useI18n } from "../i18n/I18nProvider";
import { AccountsScreen } from "../screens/AccountsScreen";
import { AddScreen } from "../screens/AddScreen";
import { DashboardScreen } from "../screens/DashboardScreen";
import { InsightsScreen } from "../screens/InsightsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { TransactionsScreen } from "../screens/TransactionsScreen";
import { colors } from "../theme";
import type { RootTabParamList } from "./types";

const Tab = createBottomTabNavigator<RootTabParamList>();

type IconName = ComponentProps<typeof Ionicons>["name"];

const ICONS: Record<keyof RootTabParamList, { active: IconName; inactive: IconName }> = {
  Dashboard: { active: "home", inactive: "home-outline" },
  Transactions: { active: "receipt", inactive: "receipt-outline" },
  Add: { active: "add-circle", inactive: "add-circle-outline" },
  Insights: { active: "pie-chart", inactive: "pie-chart-outline" },
  Accounts: { active: "wallet", inactive: "wallet-outline" },
  Settings: { active: "settings", inactive: "settings-outline" },
};

const COMMON_OPTIONS: BottomTabNavigationOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.accent,
  tabBarInactiveTintColor: colors.muted,
  tabBarStyle: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
  },
  tabBarLabelStyle: { fontSize: 11 },
};

/** Lower-case route names map directly to `nav.*` i18n keys. */
function tabOptions(
  name: keyof RootTabParamList,
  t: Translator,
): BottomTabNavigationOptions {
  return {
    tabBarLabel: t(`nav.${name.toLowerCase()}`),
    tabBarIcon: ({ focused, color, size }) => {
      const icon = ICONS[name];
      return (
        <Ionicons
          name={focused ? icon.active : icon.inactive}
          color={color}
          size={size}
        />
      );
    },
  };
}

export function RootNavigator() {
  const { t } = useI18n();

  return (
    <Tab.Navigator screenOptions={COMMON_OPTIONS}>
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={tabOptions("Dashboard", t)}
      />
      <Tab.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={tabOptions("Transactions", t)}
      />
      <Tab.Screen name="Add" component={AddScreen} options={tabOptions("Add", t)} />
      <Tab.Screen
        name="Insights"
        component={InsightsScreen}
        options={tabOptions("Insights", t)}
      />
      <Tab.Screen
        name="Accounts"
        component={AccountsScreen}
        options={tabOptions("Accounts", t)}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={tabOptions("Settings", t)}
      />
    </Tab.Navigator>
  );
}
