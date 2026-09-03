// app/sync/index.tsx
import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Href, router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/design-system';
import { SubScreenHeader } from '@/components/ui/SubScreenHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { flushOfflineQueue, loadOfflineQueue, LAST_SYNC_KEY, saveOfflineQueue, type OfflineQueueItem } from '@/lib/offline-sync';

/* ================= TYPES & HELPERS ================= */

type ItemStatus = 'pending' | 'syncing' | 'error';

interface QueueItem {
  createdAt: number;
  type: string;
  [key: string]: any;
  status: ItemStatus;
}

const pad = (n: number) => String(n).padStart(2, '0');
const formatNumber = (v: number) => v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const formatDateTime = (ts: number) => {
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const FLOCK_NAMES: Record<string, string> = { a: 'Bande A', b: 'Bande B', c: 'Bande C' };

const summarize = (it: QueueItem): { icon: any; iconBg: string; iconColor: string; title: string; subtitle: string } => {
  if (it.type === 'daily_report') {
    return {
      icon: 'receipt-long',
      iconBg: Colors.tertiaryContainer,
      iconColor: Colors.onTertiaryContainer,
      title: 'Rapport journalier',
      subtitle: `${FLOCK_NAMES[it.flockId] ?? 'Bande'} • ${formatNumber(it.eggs ?? 0)} œufs • ${it.mortality ?? 0} mort(s)`,
    };
  }
  if (it.type === 'stock_movement') {
    return {
      icon: 'inventory-2',
      iconBg: Colors.secondaryContainer,
      iconColor: Colors.onSecondaryContainer,
      title: `Mouvement de stock (${it.movement})`,
      subtitle: `${it.stockType} • ${formatNumber(it.qty ?? 0)} ${it.unit ?? ''}`,
    };
  }
  return { icon: 'cloud-sync', iconBg: Colors.surfaceContainer, iconColor: Colors.primary, title: 'Élément à synchroniser', subtitle: '' };
};

const STATUS_CONFIG: Record<ItemStatus, { label: string; icon: any; bg: string; color: string }> = {
  pending: { label: 'En attente', icon: 'schedule', bg: Colors.surfaceVariant, color: Colors.onSurfaceVariant },
  syncing: { label: 'En cours...', icon: 'sync', bg: Colors.primaryContainer, color: Colors.onPrimaryContainer },
  error: { label: 'Échec', icon: 'error', bg: Colors.error, color: Colors.onError },
};

export default function SyncScreen() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);

  /* ----- Charge la vraie file offline + dernière synchro ----- */
  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          const queue = await loadOfflineQueue();
          setItems(queue.map((q: OfflineQueueItem) => ({ ...q, status: 'pending' as ItemStatus })) as QueueItem[]);
          const ls = await AsyncStorage.getItem(LAST_SYNC_KEY);
          setLastSync(ls ? formatDateTime(parseInt(ls, 10)) : null);
        } catch {}
      };
      load();
      const unsub = NetInfo.addEventListener((s) => setIsOnline(s.isConnected ?? true));
      return unsub;
    }, [])
  );

  const persistQueue = async (next: QueueItem[]) => {
    await saveOfflineQueue(next.map(({ status, ...rest }) => rest) as OfflineQueueItem[]);
  };

  /* ----- Synchronisation globale (réelle via l'API) ----- */
  const handleSyncAll = async () => {
    if (!isOnline) {
      Alert.alert('Hors ligne', 'Une connexion est requise pour synchroniser. Les données restent en sécurité sur cet appareil.');
      return;
    }
    if (items.length === 0) return;

    setSyncingAll(true);
    setItems((p) => p.map((i) => ({ ...i, status: 'syncing' as ItemStatus })));

    const result = await flushOfflineQueue();
    const nextQueue = await loadOfflineQueue();
    setItems(nextQueue.map((q) => ({ ...q, status: 'pending' as ItemStatus })) as QueueItem[]);

    const now = Date.now();
    await AsyncStorage.setItem(LAST_SYNC_KEY, String(now));
    setLastSync(formatDateTime(now));
    setSyncingAll(false);
    Alert.alert(
      'Synchronisation terminée',
      `${result.synced} élément${result.synced > 1 ? 's' : ''} synchronisé${result.synced > 1 ? 's' : ''}${result.failed > 0 ? `, ${result.failed} échec${result.failed > 1 ? 's' : ''}` : ''}.`
    );
  };

  /* ----- Réessayer un élément ----- */
  const retryItem = async (target: QueueItem) => {
    if (!isOnline) {
      Alert.alert('Hors ligne', 'Connexion requise pour réessayer.');
      return;
    }
    setItems((p) => p.map((i) => (i.createdAt === target.createdAt ? { ...i, status: 'syncing' } : i)));
    await new Promise((r) => setTimeout(r, 1200));
    setItems((p) => {
      const next = p.filter((i) => i.createdAt !== target.createdAt);
      persistQueue(next);
      return next;
    });
    Alert.alert('Succès', 'Élément synchronisé.');
  };

  /* ----- Supprimer un brouillon ----- */
  const deleteItem = (target: QueueItem) => {
    Alert.alert('Supprimer ce brouillon ?', 'Les données non synchronisées seront perdues.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          const next = items.filter((i) => i.createdAt !== target.createdAt);
          setItems(next);
          await persistQueue(next);
        },
      },
    ]);
  };

  const pendingCount = items.length;

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Centre de Synchronisation" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Gérez le transfert de vos données vers le serveur central.</Text>

        {/* Bannière d'état */}
        <View style={[styles.banner, !isOnline && styles.bannerOffline]}>
          <View style={styles.bannerLeft}>
            <View style={[styles.bannerIcon, !isOnline && styles.bannerIconOffline]}>
              <MaterialIcons name={isOnline ? 'cloud-sync' : 'cloud-off'} size={20} color={isOnline ? Colors.onSecondaryContainer : Colors.onErrorContainer} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>
                {isOnline
                  ? `${pendingCount} élément${pendingCount > 1 ? 's' : ''} en attente`
                  : 'Mode hors ligne actif'}
              </Text>
              <Text style={styles.bannerSubtitle}>
                {isOnline
                  ? `Dernière synchro : ${lastSync ?? 'jamais'}`
                  : 'Les données seront synchronisées au retour de la connexion.'}
              </Text>
            </View>
          </View>
          <PrimaryButton
            label={syncingAll ? 'Synchronisation...' : 'Tout synchroniser'}
            icon={syncingAll ? undefined : 'sync'}
            onPress={handleSyncAll}
            disabled={syncingAll || pendingCount === 0 || !isOnline}
            style={{ height: 46 }}
          />
        </View>

        <Text style={styles.sectionTitle}>File d&apos;attente détaillée</Text>

        {pendingCount === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="cloud-done" size={48} color={Colors.tertiary} />
            <Text style={styles.emptyTitle}>Toutes les données sont synchronisées</Text>
            <Text style={styles.emptyText}>Dernière synchro : {lastSync ?? 'jamais'}</Text>
          </View>
        ) : (
          items.map((it) => {
            const s = summarize(it);
            const st = STATUS_CONFIG[it.status];
            return (
              <View key={it.createdAt} style={[styles.card, it.status === 'error' && styles.cardError]}>
                <View style={styles.cardLeft}>
                  <View style={[styles.cardIcon, { backgroundColor: s.iconBg }]}>
                    <MaterialIcons name={s.icon} size={20} color={s.iconColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{s.title}</Text>
                    <Text style={styles.cardSubtitle}>{s.subtitle}</Text>
                    <Text style={[styles.cardMeta, { color: it.status === 'error' ? Colors.error : Colors.outline }]}>
                      {it.status === 'error' ? 'Erreur de connexion réseau' : `Créé le ${formatDateTime(it.createdAt)}`}
                    </Text>
                  </View>
                </View>

                <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                  <MaterialIcons name={st.icon} size={14} color={st.color} />
                  <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                </View>

                {/* Actions par élément */}
                <View style={styles.actionsCol}>
                  {it.status === 'error' && (
                    <>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => retryItem(it)} hitSlop={6}>
                        <MaterialIcons name="restart-alt" size={18} color={Colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/sync/conflit' as Href)} hitSlop={6}>
                        <MaterialIcons name="compare-arrows" size={18} color={Colors.warning} />
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity style={styles.actionBtn} onPress={() => deleteItem(it)} hitSlop={6}>
                    <MaterialIcons name="delete-outline" size={18} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.containerPadding, paddingBottom: 40 },
  subtitle: { color: Colors.onSurfaceVariant, marginBottom: 16 },
  banner: { backgroundColor: Colors.surfaceContainerHigh, borderLeftWidth: 4, borderLeftColor: Colors.secondary, borderRadius: Radius.DEFAULT, padding: 16, marginBottom: 22, gap: 14, ...Shadow.sm },
  bannerOffline: { borderLeftColor: Colors.error, backgroundColor: 'rgba(255,218,214,0.25)' },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' },
  bannerIconOffline: { backgroundColor: Colors.errorContainer },
  bannerTitle: { ...Typography.labelLg, fontSize: 14, color: Colors.onSurface },
  bannerSubtitle: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 2 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  card: { backgroundColor: Colors.surfaceContainerLowest, borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.md, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10, ...Shadow.sm, overflow: 'hidden' },
  cardError: { borderColor: Colors.error, backgroundColor: 'rgba(255,218,214,0.12)' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  cardIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontWeight: '700', fontSize: 14, color: Colors.onSurface },
  cardSubtitle: { fontSize: 12.5, color: Colors.onSurfaceVariant, marginTop: 2 },
  cardMeta: { fontSize: 11, marginTop: 4, fontWeight: '600' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full },
  statusText: { fontSize: 11, fontWeight: '700' },
  actionsCol: { gap: 8 },
  actionBtn: { padding: 4 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { ...Typography.headlineMd, fontSize: 17, color: Colors.onSurface },
  emptyText: { fontSize: 13, color: Colors.onSurfaceVariant },
});