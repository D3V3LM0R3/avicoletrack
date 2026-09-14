// app/(tabs)/menu.tsx
import { ScreenShell } from '@/components/ui/ScreenShell';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/design-system';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Href, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { clearAuthToken } from '@/lib/auth-storage';
import { useI18n } from '@/lib/i18n';

type Role = 'OWNER' | 'MANAGER' | 'WORKER';

const ROLE_KEYS: Record<Role, 'owner' | 'manager' | 'worker'> = { OWNER: 'owner', MANAGER: 'manager', WORKER: 'worker' };

interface MenuItem {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  href: string;
  badge?: string;
}

export default function MenuScreen() {
  const { t } = useI18n();
  const [userName, setUserName] = useState('Utilisateur');
  const [enterpriseName, setEnterpriseName] = useState('');
  const [role, setRole] = useState<Role>('OWNER');
  const [syncCount, setSyncCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [showLogout, setShowLogout] = useState(false);

  // Recharge le profil + la file de sync à chaque focus de l'onglet
  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          const raw = await AsyncStorage.getItem('user_data');
          if (raw) {
            const u = JSON.parse(raw);
            if (u.name) setUserName(u.name);
            if (u.role) setRole(u.role);
            if (u.enterprise_name) setEnterpriseName(u.enterprise_name);
          }
          const queue = JSON.parse((await AsyncStorage.getItem('sync_queue')) || '[]');
          setSyncCount(Array.isArray(queue) ? queue.length : 0);
        } catch {}
      };
      load();
      const unsub = NetInfo.addEventListener((s) => setIsOnline(s.isConnected ?? true));
      return unsub;
    }, [])
  );

  const initials = userName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Sections dynamiques selon le rôle (permissions backend)
  const sections: { title: string; items: MenuItem[] }[] = [
    {
      title: t('operations'),
      items: [
        { icon: 'flutter-dash', label: t('flocks'), href: '/bandes' },
        { icon: 'inventory', label: t('inventory'), href: '/stocks' },
        { icon: 'swap-horiz', label: t('stockMovements'), href: '/mouvements' },
        ...(role === 'OWNER'
          ? ([
              { icon: 'business', label: t('farmsResults'), href: '/fermes' },
              { icon: 'badge', label: t('personnel'), href: '/personnel' },
            ] as MenuItem[])
          : []),
      ],
    },
    ...(role !== 'WORKER'
      ? [
          {
            title: t('analysis'),
            items: [
              { icon: 'insights', label: t('multiFarmAnalysis'), href: '/analyse' },
              { icon: 'event', label: t('eventsReminders'), href: '/evenements' },
              { icon: 'payments', label: t('marketPricesMenu'), href: '/prix' },
              { icon: 'history', label: t('auditHistory'), href: '/audit' },
            ] as MenuItem[],
          },
        ]
      : []),
    {
      title: t('communication'),
      items: [{ icon: 'chat', label: t('messages'), href: '/chat' }],
    },
    {
      title: t('entertainment'),
      items: [{ icon: 'sports-esports', label: t('miniGames'), href: '/games' }],
    },
    {
      title: t('system'),
      items: [
        {
          icon: 'cloud-sync',
          label: t('syncCenter'),
          href: '/sync',
          badge: syncCount > 0 ? String(syncCount) : undefined,
        },
        { icon: 'settings', label: t('settings'), href: '/parametres' },
        { icon: 'help', label: t('helpSupport'), href: '/parametres' },
      ],
    },
  ];

  const handleLogout = async () => {
    setShowLogout(false);
    // Nettoie la session (conserve has_completed_onboarding)
    await Promise.all([clearAuthToken(), AsyncStorage.removeItem('user_data')]);
    router.replace('/(auth)/login');
  };

  return (
    <ScreenShell activeTab="menu">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* PROFIL DYNAMIQUE */}
        <TouchableOpacity style={styles.profileCard} activeOpacity={0.85} onPress={() => router.push('/parametres')}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{userName}</Text>
            <Text style={styles.profileFarm}>
              {t(ROLE_KEYS[role])} • {enterpriseName || t('enterprise')}
            </Text>
            <View style={[styles.connectedPill, !isOnline && styles.offlinePill]}>
              <MaterialIcons
                name={syncCount > 0 ? 'cloud-sync' : isOnline ? 'cloud-done' : 'cloud-off'}
                size={12}
                color={syncCount > 0 ? Colors.onSecondaryContainer : isOnline ? Colors.onTertiaryContainer : Colors.onErrorContainer}
              />
              <Text style={[styles.connectedText, !isOnline && styles.offlineText]}>
                {syncCount > 0 ? `${t('waiting')} (${syncCount})` : isOnline ? t('upToDate') : t('offline')}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.card}>
              {section.items.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.row, i < section.items.length - 1 && styles.rowBorder]}
                  activeOpacity={0.7}
                  onPress={() => router.push(item.href as Href)}
                >
                  <MaterialIcons name={item.icon} size={20} color={Colors.onSurfaceVariant} />
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  {item.badge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  )}
                  <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.logout} activeOpacity={0.8} onPress={() => setShowLogout(true)}>
          <MaterialIcons name="logout" size={18} color={Colors.error} />
          <Text style={styles.logoutText}>{t('logout')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* MODAL DE CONFIRMATION DE DÉCONNEXION */}
      <Modal transparent animationType="fade" visible={showLogout} onRequestClose={() => setShowLogout(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <MaterialIcons name="logout" size={28} color={Colors.error} />
            <Text style={styles.modalTitle}>{t('logout')} ?</Text>
            <Text style={styles.modalText}>
              {syncCount > 0
                ? `${syncCount} ${t('waiting').toLowerCase()} ${syncCount > 1 ? 'items' : 'item'} - ${t('syncCenter')}.`
                : t('upToDate')}
            </Text>
            <TouchableOpacity style={styles.dangerBtn} onPress={handleLogout}>
              <Text style={styles.dangerBtnText}>{t('logout')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowLogout(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.containerPadding, paddingBottom: 40 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.md, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: Colors.outlineVariant, ...Shadow.card },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.onPrimaryContainer, fontWeight: '800', fontSize: 18 },
  profileName: { ...Typography.headlineMd, fontSize: 16, color: Colors.primary },
  profileFarm: { fontSize: 13, color: Colors.onSurfaceVariant, marginTop: 2 },
  connectedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.tertiaryContainer, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, marginTop: 6, alignSelf: 'flex-start' },
  connectedText: { color: Colors.onTertiaryContainer, fontSize: 11, fontWeight: '700' },
  offlinePill: { backgroundColor: Colors.errorContainer },
  offlineText: { color: Colors.onErrorContainer },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginLeft: 4 },
  card: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.outlineVariant, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 15 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.surfaceVariant },
  rowLabel: { flex: 1, fontSize: 14, color: Colors.onSurface, fontWeight: '500' },
  badge: { backgroundColor: Colors.error, borderRadius: Radius.full, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, padding: 14 },
  logoutText: { color: Colors.error, fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.lg, padding: 24, width: '100%', alignItems: 'center', gap: 12 },
  modalTitle: { ...Typography.headlineMd, fontSize: 18, color: Colors.onSurface },
  modalText: { ...Typography.bodyMd, fontSize: 14, color: Colors.onSurfaceVariant, textAlign: 'center' },
  dangerBtn: { backgroundColor: Colors.error, borderRadius: Radius.full, paddingVertical: 14, paddingHorizontal: 24, width: '100%', alignItems: 'center' },
  dangerBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn: { paddingVertical: 10 },
  cancelText: { color: Colors.onSurfaceVariant, fontWeight: '600' },
});