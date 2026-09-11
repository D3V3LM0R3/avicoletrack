import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Redirect, Stack, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { AUTH_CHANGED_EVENT, getAuthToken } from '@/lib/auth-storage';
import { PreferencesProvider, usePreferences } from '@/lib/app-preferences';
import { flushOfflineQueue } from '@/lib/offline-sync';

const ROUTE_ACCESS: Record<string, string[]> = {
  setup: ['OWNER'],
  fermes: ['OWNER'],
  personnel: ['OWNER'],
  analyse: ['OWNER', 'MANAGER'],
  audit: ['OWNER', 'MANAGER'],
  evenements: ['OWNER', 'MANAGER'],
  prix: ['OWNER', 'MANAGER'],
  bandes: ['OWNER', 'MANAGER', 'WORKER'],
  stocks: ['OWNER', 'MANAGER', 'WORKER'],
  mouvements: ['OWNER', 'MANAGER', 'WORKER'],
  sync: ['OWNER', 'MANAGER', 'WORKER'],
  parametres: ['OWNER', 'MANAGER', 'WORKER'],
  rapports: ['OWNER', 'MANAGER', 'WORKER'],
  saisie: ['OWNER', 'MANAGER', 'WORKER'],
  index: ['OWNER', 'MANAGER', 'WORKER'],
};

const canAccessRoute = (role: string | null, segments: string[]) => {
  if (!role) return false;
  if (segments.length === 0) return true;

  const candidates = segments.filter((segment) => !segment.startsWith('(') && segment !== 'index');
  const firstRoute = candidates[0] ?? 'index';
  const allowed = ROUTE_ACCESS[firstRoute] ?? ['OWNER', 'MANAGER', 'WORKER'];
  return allowed.includes(role);
};

export const unstable_settings = {
  anchor: '(auth)',
};

export default function RootLayout() {
  const segments = useSegments();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setAuthenticated(false);
        setRole(null);
      }
    }, 3000);

    const loadAuth = async () => {
      try {
        const token = await getAuthToken();
        if (cancelled) return;
        setAuthenticated(Boolean(token));

        if (!token) {
          setRole(null);
          return;
        }

        const raw = await AsyncStorage.getItem('user_data');
        if (!cancelled) {
          const user = raw ? JSON.parse(raw) : {};
          setRole(user?.role ?? null);
        }
      } catch {
        if (!cancelled) {
          setAuthenticated(false);
          setRole(null);
        }
      }
    };

    void loadAuth();

    const handleAuthChanged = () => {
      setAuthenticated(null);
      void loadAuth();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
    }

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (typeof window !== 'undefined') {
        window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
      }
    };
  }, []);

  const inAuthGroup = segments[0] === '(auth)';
  const inPublicEntry = segments[0] === undefined;
  const routeAllowed = canAccessRoute(role, segments);

  if (authenticated === null) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /></View>;
  }
  if (!authenticated && !inAuthGroup && !inPublicEntry) return <Redirect href="/(auth)/login" />;
  if (authenticated && role && !routeAllowed) return <Redirect href="/(tabs)" />;

  return (
    <PreferencesProvider>
      <AppNavigation />
    </PreferencesProvider>
  );
}

function AppNavigation() {
  const { theme } = usePreferences();
  return (
      <ThemeProvider
      value={theme === 'dark' ? DarkTheme : DefaultTheme}
      >
      <OfflineQueueReplayer />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="bandes/index" />
        <Stack.Screen name="bandes/[id]" />
        <Stack.Screen name="stocks/index" />
        <Stack.Screen name="stocks/mouvement" />
        <Stack.Screen name="personnel/index" />
        <Stack.Screen name="sync/index" />
        <Stack.Screen name="sync/conflit" />
        <Stack.Screen name="parametres/index" />
      </Stack>

      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      </ThemeProvider>
  );
}

function OfflineQueueReplayer() {
  const replaying = useRef(false);

  useEffect(() => {
    const replay = async () => {
      if (replaying.current || !(await getAuthToken())) return;
      replaying.current = true;
      try {
        await flushOfflineQueue();
      } finally {
        replaying.current = false;
      }
    };

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected === true) void replay();
    });
    const handleAuthChanged = () => void replay();
    if (typeof window !== 'undefined') {
      window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
    }
    void replay();
    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
      }
    };
  }, []);

  return null;
}