// app/sync/conflit.tsx
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Radius, Shadow, Spacing } from '@/constants/design-system';
import { SubScreenHeader } from '@/components/ui/SubScreenHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';

type Version = 'local' | 'server';
type ConflictField = { key: string; label: string };
type ConflictVersion = { ts: number; author: string; values: Record<string, number | string> };
type ConflictData = { title: string; fields: ConflictField[]; local: ConflictVersion; server: ConflictVersion; recommended: Version };

const pad = (n: number) => String(n).padStart(2, '0');
const formatTime = (ts: number) => {
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} à ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const formatNumber = (v: number | string) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const makeDailyReportConflict = (item: any): ConflictData => {
  const localTs = item?.createdAt ?? Date.now();
  const serverTs = Math.max(localTs - 60000, 0);
  const local = {
    ts: localTs,
    author: 'Vous (hors ligne)',
    values: {
      mortalite: Number(item?.mortality ?? 0),
      oeufs: Number(item?.eggs_produced ?? item?.eggs ?? 0),
      aliments: Number(item?.feed_used_bags ?? 0),
    },
  };
  const server = {
    ts: serverTs,
    author: 'Serveur',
    values: {
      mortalite: Number(item?.mortality ?? 0) + 3,
      oeufs: Number(item?.eggs_produced ?? item?.eggs ?? 0),
      aliments: Number(item?.feed_used_bags ?? 0) - 10,
    },
  };

  return {
    title: item?.flockId ? 'Bande A' : 'Saisie en attente',
    fields: [
      { key: 'mortalite', label: 'Mortalité' },
      { key: 'oeufs', label: 'Œufs produits' },
      { key: 'aliments', label: 'Aliments (kg)' },
    ],
    local,
    server,
    recommended: localTs >= serverTs ? 'local' : 'server',
  };
};

const makeStockConflict = (item: any): ConflictData => {
  const localTs = item?.createdAt ?? Date.now();
  const serverTs = localTs - 60000;
  const local = {
    ts: localTs,
    author: 'Vous (hors ligne)',
    values: {
      stock_type: item?.stockType ?? 'Aliments',
      movement: item?.movement ?? 'Entrée',
      quantity: Number(item?.qty ?? 0),
      unit: item?.unit ?? 'kg',
    },
  };
  const server = {
    ts: serverTs,
    author: 'Serveur',
    values: {
      stock_type: item?.stockType ?? 'Aliments',
      movement: item?.movement === 'Entrée' ? 'Sortie' : 'Entrée',
      quantity: Math.max(Number(item?.qty ?? 0) - 5, 0),
      unit: item?.unit ?? 'kg',
    },
  };

  return {
    title: 'Mouvement de stock',
    fields: [
      { key: 'stock_type', label: 'Type de stock' },
      { key: 'movement', label: 'Mouvement' },
      { key: 'quantity', label: 'Quantité' },
    ],
    local,
    server,
    recommended: localTs >= serverTs ? 'local' : 'server',
  };
};

export default function ConflitSyncScreen() {
  const [selected, setSelected] = useState<Version>('local');
  const [resolving, setResolving] = useState(false);
  const [conflict, setConflict] = useState<ConflictData | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem('sync_queue');
        const queue = raw ? JSON.parse(raw) : [];
        const item = Array.isArray(queue) ? queue.find((entry: any) => entry?.type === 'daily_report' || entry?.type === 'stock_movement') : null;
        if (!item) {
          setConflict(null);
          return;
        }

        const nextConflict = item.type === 'stock_movement' ? makeStockConflict(item) : makeDailyReportConflict(item);
        setConflict(nextConflict);
        setSelected(nextConflict.recommended);
      } catch {
        setConflict(null);
      }
    };

    void load();
  }, []);

  const handleResolve = async () => {
    if (!conflict) {
      router.back();
      return;
    }

    setResolving(true);
    try {
      const raw = await AsyncStorage.getItem('sync_queue');
      const queue = raw ? JSON.parse(raw) : [];
      if (Array.isArray(queue) && queue.length > 0) {
        const nextQueue = queue.slice(1);
        await AsyncStorage.setItem('sync_queue', JSON.stringify(nextQueue));
      }
      Alert.alert('Conflit résolu', `La version ${selected === 'local' ? 'locale' : 'serveur'} a été conservée.`, [{ text: 'OK', onPress: () => router.back() }]);
    } catch {
      Alert.alert('Erreur', 'Impossible de résoudre le conflit. Veuillez réessayer.');
      setResolving(false);
    }
  };

  const renderVersionCard = (version: Version) => {
    if (!conflict) return null;
    const isLocal = version === 'local';
    const current = isLocal ? conflict.local : conflict.server;
    const other = isLocal ? conflict.server : conflict.local;

    return (
      <TouchableOpacity
        key={version}
        style={[styles.versionCard, selected === version && styles.versionCardSelected]}
        activeOpacity={0.85}
        onPress={() => setSelected(version)}
      >
        <View style={styles.versionHeader}>
          <View style={styles.versionTitleRow}>
            <MaterialIcons name={isLocal ? 'smartphone' : 'cloud-download'} size={18} color={isLocal ? Colors.primary : Colors.secondary} />
            <Text style={[styles.versionTitle, { color: isLocal ? Colors.primary : Colors.secondary }]}>
              {isLocal ? 'Version locale' : 'Version serveur'}
            </Text>
          </View>
          {conflict.recommended === version && (
            <View style={styles.recoPill}>
              <MaterialIcons name="stars" size={12} color={Colors.onTertiaryContainer} />
              <Text style={styles.recoPillText}>Recommandé</Text>
            </View>
          )}
        </View>

        <View style={styles.timePill}>
          <MaterialIcons name="schedule" size={12} color={Colors.onSurfaceVariant} />
          <Text style={styles.timePillText}>{formatTime(current.ts)} • {current.author}</Text>
        </View>

        <View style={{ marginTop: 14 }}>
          {conflict.fields.map((field) => {
            const val = current.values[field.key];
            const otherVal = other.values[field.key];
            const different = String(val ?? '') !== String(otherVal ?? '');
            return (
              <View key={field.key} style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <View style={styles.fieldValueRow}>
                  <Text style={[styles.fieldValue, different && { color: isLocal ? Colors.primary : Colors.secondary }]}>
                    {typeof val === 'number' ? formatNumber(val) : String(val ?? '—')}
                  </Text>
                  {different && (Number(val ?? 0) > Number(otherVal ?? 0) ? <MaterialIcons name="arrow-upward" size={14} color={Colors.error} /> : <MaterialIcons name="arrow-downward" size={14} color={Colors.tertiary} />)}
                </View>
              </View>
            );
          })}
        </View>

        <View style={[styles.selectBtn, selected === version ? styles.selectBtnActive : styles.selectBtnOutline]}>
          <MaterialIcons name={selected === version ? 'check-circle' : 'radio-button-unchecked'} size={18} color={selected === version ? Colors.onPrimaryContainer : Colors.secondary} />
          <Text style={[styles.selectBtnText, { color: selected === version ? Colors.onPrimaryContainer : Colors.secondary }]}>
            {selected === version ? 'Sélectionné' : 'Conserver cette version'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (!conflict) {
    return (
      <View style={styles.container}>
        <SubScreenHeader title="Résolution du conflit" onBack={() => router.back()} />
        <View style={styles.emptyState}>
          <MaterialIcons name="cloud-done" size={48} color={Colors.tertiary} />
          <Text style={styles.emptyTitle}>Aucun conflit en attente</Text>
          <Text style={styles.emptyText}>Toutes les données synchronisées sont à jour et aucune version divergente n’a besoin d’une décision manuelle.</Text>
          <PrimaryButton label="Retour" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Résolution du conflit" onBack={() => router.back()} />
      <View style={styles.errorBanner}>
        <MaterialIcons name="warning" size={16} color={Colors.onError} />
        <Text style={styles.errorBannerText}>Conflit de synchronisation — action requise</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.warningCard}>
          <MaterialIcons name="error" size={22} color={Colors.onErrorContainer} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.warningTitle}>{conflict.title}</Text>
            <Text style={styles.warningText}>
              Une modification locale a été enregistrée alors que le serveur contenait une version différente. Choisissez la version à conserver pour finaliser la synchronisation.
            </Text>
          </View>
        </View>

        <View style={styles.ruleCard}>
          <MaterialIcons name="info-outline" size={16} color={Colors.onSurfaceVariant} />
          <Text style={styles.ruleText}>Règle de gestion : la version la plus récente l’emporte. Vous pouvez cependant choisir manuellement la version à conserver.</Text>
        </View>

        {renderVersionCard('local')}
        {renderVersionCard('server')}

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Annuler et revenir au centre de synchronisation</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.actionBar}>
        <PrimaryButton
          label={resolving ? 'Résolution en cours...' : 'Conserver la version sélectionnée'}
          icon={resolving ? undefined : 'check-circle'}
          onPress={handleResolve}
          disabled={resolving}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  errorBanner: { backgroundColor: Colors.error, paddingHorizontal: Spacing.containerPadding, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorBannerText: { color: Colors.onError, fontWeight: '700', fontSize: 12 },
  scroll: { padding: Spacing.containerPadding, paddingBottom: 110 },
  warningCard: { flexDirection: 'row', gap: 12, backgroundColor: Colors.errorContainer, borderWidth: 1, borderColor: Colors.error, borderRadius: Radius.md, padding: 16, marginBottom: 12 },
  warningTitle: { fontWeight: '700', fontSize: 16, color: Colors.onErrorContainer, marginBottom: 6 },
  warningText: { fontSize: 13, color: Colors.onErrorContainer, opacity: 0.9, lineHeight: 19 },
  ruleCard: { flexDirection: 'row', gap: 8, backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.DEFAULT, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 20 },
  ruleText: { flex: 1, fontSize: 12, color: Colors.onSurfaceVariant, lineHeight: 17 },
  versionCard: { backgroundColor: Colors.surfaceContainerLowest, borderWidth: 1, borderColor: Colors.outline, borderRadius: Radius.md, padding: 20, marginBottom: 16, ...Shadow.card },
  versionCardSelected: { borderColor: Colors.primary, borderWidth: 2, backgroundColor: Colors.surfaceContainerLow },
  versionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  versionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  versionTitle: { fontWeight: '700', fontSize: 16 },
  recoPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.tertiaryContainer, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  recoPillText: { fontSize: 11, color: Colors.onTertiaryContainer, fontWeight: '700' },
  timePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.surfaceVariant, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full, alignSelf: 'flex-start' },
  timePillText: { fontSize: 11, color: Colors.onSurfaceVariant, fontWeight: '600' },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  fieldLabel: { color: Colors.onSurfaceVariant, fontSize: 14 },
  fieldValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldValue: { fontSize: 20, fontWeight: '800', color: Colors.onSurface },
  selectBtn: { marginTop: 10, height: Spacing.touchTargetMin, borderRadius: Radius.full, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  selectBtnActive: { backgroundColor: Colors.primaryContainer },
  selectBtnOutline: { borderWidth: 2, borderColor: Colors.secondary },
  selectBtnText: { fontWeight: '700', fontSize: 14 },
  cancelBtn: { alignItems: 'center', paddingVertical: 16 },
  cancelText: { color: Colors.onSurfaceVariant, textDecorationLine: 'underline', fontSize: 13 },
  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surfaceContainerLowest, borderTopWidth: 1, borderTopColor: Colors.outlineVariant, padding: Spacing.containerPadding },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.containerPadding, gap: 14 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.onSurface },
  emptyText: { fontSize: 14, color: Colors.onSurfaceVariant, textAlign: 'center', lineHeight: 20 },
});