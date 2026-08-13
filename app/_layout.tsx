import { AuthProvider, useAuth } from '@/src/context/AuthContext';
import { colors } from '@/src/theme/colors';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

function Navigation() {
  const { user } = useAuth();

  return (
    <Stack screenOptions={{ headerTintColor: colors.text, headerShadowVisible: false, headerStyle: { backgroundColor: colors.background }, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={Boolean(user)}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="deck/form" options={{ title: 'Bộ từ' }} />
        <Stack.Screen name="deck/[id]" options={{ title: 'Chi tiết bộ từ' }} />
        <Stack.Screen name="card/form" options={{ title: 'Thẻ từ' }} />
        <Stack.Screen name="word/[deckId]/[cardId]" options={{ title: 'Chi tiết từ' }} />
        <Stack.Screen name="review/[deckId]" options={{ title: 'Ôn tập', headerBackTitle: 'Thoát' }} />
        <Stack.Screen name="review/result" options={{ title: 'Kết quả', headerBackVisible: false }} />
        <Stack.Screen name="practice/[deckId]" options={{ title: 'Luyện tập' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <AuthProvider>
        <Navigation />
        <StatusBar style="dark" />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
