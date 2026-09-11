import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/design-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { listNotifications } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

export type NavItem = {
  key: string;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  badge?: boolean;
};

const DEFAULT_ITEMS: NavItem[] = [
  { key: 'index', label: 'Accueil', icon: 'home' },
  { key: 'saisie', label: 'Saisie', icon: 'edit-note' },
  { key: 'alertes', label: 'Alertes', icon: 'notifications', badge: true },
  { key: 'rapports', label: 'Rapports', icon: 'assessment' },
  { key: 'capital', label: 'Capital', icon: 'trending-up' },
  { key: 'menu', label: 'Menu', icon: 'menu' },
];

type Props = {
  activeKey: string;
  onPress: (key: string) => void;
};

export function BottomNav({ activeKey, onPress }: Props) {
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState('OWNER');
  const [hasAlert, setHasAlert] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    AsyncStorage.getItem('user_data')
      .then(async (raw) => {
        if (!raw) return;
        const nextRole = JSON.parse(raw).role || 'OWNER';
        setRole(nextRole);
      })
      .catch(() => {});
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      listNotifications()
        .then((items) => setHasAlert(items.some((item) => !item.read_at)))
        .catch(() => setHasAlert(false));
    }, [])
  );

  const translated = {
    index: t('home'),
    saisie: t('entry'),
    alertes: t('alerts'),
    rapports: t('reports'),
    capital: 'Capital',
    menu: t('menu'),
  };
  const items = DEFAULT_ITEMS
    .filter((item) => {
      if (item.key === 'capital' && role !== 'OWNER') return false;
      if (item.key === 'saisie' && role !== 'WORKER') return false;
      return true;
    })
    .map((item) => ({
      ...item,
      label: item.key === 'alertes' && role === 'MANAGER' ? 'Notifications' : translated[item.key as keyof typeof translated],
    }));

  return (
    <View
      style={[
        styles.container,
          { backgroundColor: Colors.surface, borderTopColor: Colors.outlineVariant },
        { paddingBottom: Math.max(insets.bottom, 10) },
      ]}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        const showBadge = item.key === 'alertes' && hasAlert;
        return (
          <TouchableOpacity
            key={item.key}
            onPress={() => onPress(item.key)}
            activeOpacity={0.8}
            style={styles.itemTouchable}
          >
            <View style={[styles.itemInner, active && styles.itemInnerActive]}>
              <View>
                <MaterialIcons
                  name={item.icon}
                  size={22}
                  color={active ? Colors.onPrimaryContainer : Colors.onSurfaceVariant}
                />
                {showBadge && (
                  <View style={styles.badgeDot} />
                )}
              </View>
              <Text
                style={[
                  styles.label,
                  { color: active ? Colors.onPrimaryContainer : Colors.onSurfaceVariant },
                ]}
              >
                {item.label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
    paddingTop: 8,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  itemTouchable: {
    flex: 1,
    alignItems: 'center',
  },
  itemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    gap: 2,
  },
  itemInnerActive: {
    backgroundColor: Colors.primaryContainer,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
});
