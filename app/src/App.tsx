import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { I18nProvider } from "./i18n/I18nProvider";
import { RootNavigator } from "./navigation/RootNavigator";
import { AppStoreProvider } from "./store/AppStore";
import { colors } from "./theme";

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AppStoreProvider>
          <StatusBar style="auto" />
          <NavigationContainer theme={navigationTheme}>
            <RootNavigator />
          </NavigationContainer>
        </AppStoreProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
