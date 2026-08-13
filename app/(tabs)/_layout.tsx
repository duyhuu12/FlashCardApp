import { colors } from '@/src/theme/colors';
import { Tabs } from 'expo-router';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

const tabIcons = {
  learning: require('@/assets/images/tab-icons/learning.png'),
  vocabulary: require('@/assets/images/tab-icons/vocabulary.png'),
  explore: require('@/assets/images/tab-icons/explore.png'),
  progress: require('@/assets/images/tab-icons/progress.png'),
  settings: require('@/assets/images/tab-icons/settings.png'),
} satisfies Record<string, ImageSourcePropType>;

function GameTabIcon({ source, focused }: { source: ImageSourcePropType; focused: boolean }) {
  return (
    <View style={[styles.iconShell, focused && styles.iconShellFocused]}>
      <Image source={source} resizeMode="contain" style={[styles.icon, !focused && styles.iconInactive]} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          height: 82,
          paddingTop: 5,
          paddingBottom: 8,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
        },
        tabBarLabelStyle: { fontWeight: '900', fontSize: 10 },
        tabBarItemStyle: { paddingTop: 2 },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Học tập', tabBarIcon: ({ focused }) => <GameTabIcon source={tabIcons.learning} focused={focused} /> }} />
      <Tabs.Screen name="vocabulary" options={{ title: 'Từ vựng', tabBarIcon: ({ focused }) => <GameTabIcon source={tabIcons.vocabulary} focused={focused} /> }} />
      <Tabs.Screen name="community" options={{ title: 'Khám phá', tabBarIcon: ({ focused }) => <GameTabIcon source={tabIcons.explore} focused={focused} /> }} />
      <Tabs.Screen name="stats" options={{ title: 'Tiến độ', tabBarIcon: ({ focused }) => <GameTabIcon source={tabIcons.progress} focused={focused} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Cài đặt', tabBarIcon: ({ focused }) => <GameTabIcon source={tabIcons.settings} focused={focused} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconShell: {
    width: 48,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  iconShellFocused: {
    borderWidth: 2,
    borderColor: '#8C83E8',
    backgroundColor: colors.primarySoft,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 7,
    elevation: 5,
  },
  icon: { width: 43, height: 43 },
  iconInactive: { opacity: 0.58, transform: [{ scale: 0.9 }] },
});
