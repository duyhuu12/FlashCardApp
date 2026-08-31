import {
  useAppTheme,
  useThemedStyles,
  type AppColors,
} from "@/src/theme/colors";
import { Tabs } from "expo-router";
import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const tabIcons = {
  learning: require("@/assets/images/tab-icons/learning.png"),
  vocabulary: require("@/assets/images/tab-icons/vocabulary.png"),
  explore: require("@/assets/images/tab-icons/explore.png"),
  progress: require("@/assets/images/tab-icons/progress.png"),
  settings: require("@/assets/images/tab-icons/settings.png"),
} satisfies Record<string, ImageSourcePropType>;

function GameTabIcon({
  source,
  focused,
}: {
  source: ImageSourcePropType;
  focused: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.iconShell, focused && styles.iconShellFocused]}>
      <Image
        source={source}
        resizeMode="contain"
        style={[styles.icon, !focused && styles.iconInactive]}
      />
    </View>
  );
}

export default function TabLayout() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom;
  const tabBarHeight = 60 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          height: tabBarHeight,
          paddingTop: 6,
          paddingBottom: bottomInset > 0 ? bottomInset : 6,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
          elevation: 8,
        },
        tabBarItemStyle: { justifyContent: "center", height: 48 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <GameTabIcon source={tabIcons.learning} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="vocabulary"
        options={{
          tabBarIcon: ({ focused }) => (
            <GameTabIcon source={tabIcons.vocabulary} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          tabBarIcon: ({ focused }) => (
            <GameTabIcon source={tabIcons.explore} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          tabBarIcon: ({ focused }) => (
            <GameTabIcon source={tabIcons.progress} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <GameTabIcon source={tabIcons.settings} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    iconShell: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
    },
    iconShellFocused: {
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
      shadowColor: colors.primaryDark,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 7,
      elevation: 5,
    },
    icon: { width: 38, height: 38 },
    iconInactive: { opacity: 0.58, transform: [{ scale: 0.9 }] },
  });
