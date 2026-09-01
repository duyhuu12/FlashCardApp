import { useThemedStyles, type AppColors } from '@/src/theme/colors';
import type { PropsWithChildren, ReactNode, Ref } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

interface Props extends PropsWithChildren {
  scroll?: boolean;
  contentStyle?: ViewStyle;
  refreshControl?: ScrollViewProps['refreshControl'];
  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle' | 'refreshControl'>;
  scrollRef?: Ref<ScrollView>;
  floatingContent?: ReactNode;
  safeAreaEdges?: Edge[];
}

export function AppScreen({ children, scroll = true, contentStyle, refreshControl, scrollProps, scrollRef, floatingContent, safeAreaEdges = ['top', 'left', 'right', 'bottom'] }: Props) {
  const styles = useThemedStyles(createStyles);
  return (
    <SafeAreaView style={styles.safe} edges={safeAreaEdges}>
      {scroll ? (
        <ScrollView
          {...scrollProps}
          ref={scrollRef}
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.flex, contentStyle]}>{children}</View>
      )}
      {floatingContent}
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: 20, gap: 16 },
});
