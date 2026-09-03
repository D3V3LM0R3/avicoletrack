import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/design-system';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { usePreferences } from '@/lib/app-preferences';

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
  return (
    <View style={[styles.container, { backgroundColor: Colors.background }]}>
      <TopBar farmName={farmName} />
      <View style={styles.content}>{children}</View>
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
    paddingBottom: 90,
  },
});
