// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // 👇 Masque la barre d'onglets native :
        // la navigation est gérée par ton BottomNav personnalisé dans ScreenShell
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="saisie" />
      <Tabs.Screen name="mouvements" />
      <Tabs.Screen name="alertes" />
      <Tabs.Screen name="rapports" />
      <Tabs.Screen name="capital" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="menu" />
    </Tabs>
  );
}