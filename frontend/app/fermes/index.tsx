// app/fermes/index.tsx
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { MaterialIcons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/design-system';
import { SubScreenHeader } from '@/components/ui/SubScreenHeader';
import { FormField } from '@/components/ui/FormField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { createFarm, listDailyReports, listFarmMembers, listFarms, listFlocks, updateFarm, type Farm as ApiFarm } from '@/lib/api';
import { enqueueOfflineItem } from '@/lib/offline-sync';

interface Farm extends ApiFarm { members: number; flocks: number; }

const INITIAL: Farm[] = [];

export default function FermesScreen() {
  const [farms, setFarms] = useState(INITIAL);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 2800);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => setIsOnline(state.isConnected ?? true));
    return unsub;
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([listFarms(true), listFlocks(true), listDailyReports()]).then(async ([items, flocks, reports]) => {
      const enriched = await Promise.all(items.map(async (farm) => {
        const members = await listFarmMembers(farm.id).catch(() => []);
        return { ...farm, members: members.length, flocks: flocks.filter((flock) => flock.farm_id === farm.id).length, reports: reports.filter((report) => report.farm_id === farm.id).length };
      }));
      setFarms(enriched);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) { setNameError('Le nom de la ferme est obligatoire.'); return; }
    setSaving(true);
    try {
      const payload = { name: name.trim(), location: location.trim() || undefined };
      if (!isOnline) {
        const localId = -Date.now();
        await enqueueOfflineItem({ type: 'farm', createdAt: Date.now(), local_id: localId, name: payload.name, location: payload.location ?? null });
        setFarms((current) => [...current, {
          id: localId,
          enterprise_id: 0,
          name: payload.name,
          location: payload.location ?? null,
          active: true,
          created_at: new Date().toISOString(),
          food_type: null,
          food_quantity: 0,
          food_unit: 'kg',
          water_quantity: 0,
          water_unit: 'L',
          egg_stock: 0,
          cartons: 0,
          alveoli: 0,
          mortality: 0,
          members: 0,
          flocks: 0,
        }]);
        setShowCreate(false); setName(''); setLocation(''); setNameError('');
        Alert.alert('Mode hors-ligne', 'Ferme enregistrée localement. Elle sera synchronisée au retour du réseau.', [{ text: 'OK' }]);
        return;
      }

      const farm = await createFarm(payload);
      setFarms((p) => [...p, { ...farm, members: 0, flocks: 0 }]);
      setShowCreate(false); setName(''); setLocation(''); setNameError('');
      setToast('Ferme créée avec succès.');
    } catch (error) {
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Impossible de créer la ferme.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = (farm: Farm) => {
    Alert.alert(
      farm.active ? 'Désactiver cette ferme ?' : 'Réactiver cette ferme ?',
      farm.active ? 'La ferme ne sera plus sélectionnable, mais les données sont conservées.' : 'La ferme redeviendra sélectionnable.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: async () => { try { const updated = await updateFarm(farm.id, { active: !farm.active }); setFarms((p) => p.map((f) => f.id === farm.id ? { ...f, active: updated.active } : f)); } catch (error) { Alert.alert('Erreur', error instanceof Error ? error.message : 'Impossible de modifier la ferme.'); } } },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Fermes" onBack={() => router.back()} />
      {toast !== '' && (
        <View style={styles.toast}>
          <MaterialIcons name="check-circle" size={16} color={Colors.primary} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={Colors.primary} size="small" />
            <Text style={styles.loadingText}>Chargement des fermes…</Text>
          </View>
        ) : farms.map((f) => (
          <TouchableOpacity key={f.id} style={styles.card} activeOpacity={0.85} onPress={() => router.push(`/fermes/${f.id}` as Href)}>
            <View style={styles.cardHeader}>
              <View style={styles.farmIcon}>
                <MaterialIcons name="business" size={22} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.farmName}>{f.name}</Text>
                <Text style={styles.farmLocation}>{f.location}</Text>
              </View>
              <View style={[styles.statusBadge, !f.active && styles.statusBadgeInactive]}>
                <Text style={[styles.statusText, !f.active && styles.statusTextInactive]}>
                  {f.active ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <Text style={styles.stat}>{f.members} membre{f.members > 1 ? 's' : ''}</Text>
              <Text style={styles.statDot}>•</Text>
              <Text style={styles.stat}>{f.flocks} bande{f.flocks > 1 ? 's' : ''}</Text>
            </View>
            <TouchableOpacity style={styles.toggleBtn} onPress={() => toggleActive(f)}>
              <MaterialIcons name={f.active ? 'block' : 'check-circle'} size={16} color={f.active ? Colors.error : Colors.primary} />
              <Text style={[styles.toggleText, { color: f.active ? Colors.error : Colors.primary }]}>
                {f.active ? 'Désactiver' : 'Réactiver'}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        <PrimaryButton label="Nouvelle ferme" icon="add-business" onPress={() => setShowCreate(true)} />
      </ScrollView>

      <Modal transparent animationType="slide" visible={showCreate} onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Créer une ferme</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)} hitSlop={10}>
                <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <FormField label="Nom de la ferme" icon="business" placeholder="Ferme de ..." value={name} onChangeText={(t) => { setName(t); setNameError(''); }} />
              {nameError !== '' && <Text style={styles.errorText}>{nameError}</Text>}
              <FormField label="Localisation" icon="location-on" placeholder="Ville, région" value={location} onChangeText={setLocation} />
              <PrimaryButton label={saving ? 'Création...' : 'Créer la ferme'} onPress={handleCreate} disabled={saving} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  toast: { position: 'absolute', top: 14, left: 16, right: 16, zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(13,99,27,0.12)', borderRadius: Radius.DEFAULT, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(13,99,27,0.2)' },
  toastText: { color: Colors.primary, fontSize: 12.5, fontWeight: '700', flexShrink: 1 },
  loadingBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  loadingText: { color: Colors.onSurfaceVariant, fontSize: 13, fontWeight: '600' },
  scroll: { padding: Spacing.containerPadding, paddingBottom: 40, gap: Spacing.stackGap },
  card: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.outlineVariant, padding: 16, ...Shadow.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  farmIcon: { width: 44, height: 44, borderRadius: Radius.DEFAULT, backgroundColor: Colors.surfaceContainerLow, alignItems: 'center', justifyContent: 'center' },
  farmName: { fontWeight: '700', fontSize: 15, color: Colors.onSurface },
  farmLocation: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 2 },
  statusBadge: { backgroundColor: Colors.tertiaryContainer, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  statusBadgeInactive: { backgroundColor: Colors.surfaceContainerHigh },
  statusText: { color: Colors.onTertiaryContainer, fontSize: 11, fontWeight: '700' },
  statusTextInactive: { color: Colors.onSurfaceVariant },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  stat: { fontSize: 12, color: Colors.onSurfaceVariant },
  statDot: { color: Colors.outline },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.surfaceVariant },
  toggleText: { fontWeight: '700', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '86%', width: '100%', backgroundColor: Colors.surfaceContainerLowest, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingTop: 10, paddingBottom: 24, gap: 12 },
  modalHandle: { width: 42, height: 5, borderRadius: 999, backgroundColor: Colors.outlineVariant, alignSelf: 'center', marginBottom: 4 },
  modalScroll: { maxHeight: '100%' },
  modalScrollContent: { paddingHorizontal: Spacing.containerPadding, paddingBottom: 12, gap: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.containerPadding },
  modalTitle: { ...Typography.headlineMd, fontSize: 20, color: Colors.onSurface },
  errorText: { color: Colors.error, fontSize: 12, marginTop: -8, marginBottom: 8, marginLeft: 4 },
  summaryLine: { fontSize: 15, color: Colors.onSurface, fontWeight: '600' },
  summaryHint: { fontSize: 13, color: Colors.onSurfaceVariant, lineHeight: 19 },
});