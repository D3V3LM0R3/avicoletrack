import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/design-system';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { usePreferences } from '@/lib/app-preferences';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const BOTTOM_NAV_CONTENT_HEIGHT = 64;

type Props = {
  children: React.ReactNode;
  activeTab: string;
  farmName?: string;
};

const ROUTES: Record<string, string> = {
  index: '/(tabs)',
  saisie: '/(tabs)/saisie',
  mouvements: '/(tabs)/mouvements',
  alertes: '/(tabs)/alertes',
  rapports: '/(tabs)/rapports',
  capital: '/(tabs)/capital',
  chat: '/(tabs)/chat',
  games: '/(tabs)/games',
  menu: '/(tabs)/menu',
};

export function ScreenShell({ children, activeTab, farmName }: Props) {
  usePreferences();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <TopBar farmName={farmName} />
      <View style={[styles.content, { paddingBottom: BOTTOM_NAV_CONTENT_HEIGHT + Math.max(insets.bottom, 10) }]}>
        <View style={styles.contentInner}>{children}</View>
      </View>
      <BottomNav
        activeKey={activeTab}
        onPress={(key) => router.push(ROUTES[key] as any)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    flex: 1,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
});
