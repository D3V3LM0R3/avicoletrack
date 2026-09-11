// app/bandes/index.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import NetInfo from '@react-native-community/netinfo';
import { MaterialIcons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/design-system';
import { SubScreenHeader } from '@/components/ui/SubScreenHeader';
import { FormField } from '@/components/ui/FormField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { createFlock, getFarmPermissionState, listEvents, listFlockRacePresets, listFlocks, listFarms, updateFlock, type Event, type Farm, type Flock as ApiFlock } from '@/lib/api';
import { enqueueOfflineItem } from '@/lib/offline-sync';

/* ================= HELPERS ================= */

const pad = (n: number) => String(n).padStart(2, '0');
const formatFr = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
const formatNumber = (v: number) => v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const computeAge = (startIso: string) => {
  const days = Math.floor((Date.now() - new Date(startIso).getTime()) / 86400000);
  if (days < 56) return { value: days, unit: 'jours', weeks: Math.floor(days / 7) };
  return { value: Math.floor(days / 7), unit: 'sem.', weeks: Math.floor(days / 7) };
};

interface Flock {
  id: string;
  farmId: number;
  name: string;
  breed: string;
  start: string;
  birdCount: number;
  archived: boolean;
  eventTypes?: string[];
}

const INITIAL_FLOCKS: Flock[] = [];
const PRESET_BREEDS = ['ISA Brown', 'Lohmann', 'Rhode Island Red', 'Label', 'Plymouth Rock'];

type FilterKey = 'toutes' | 'actives' | 'attention' | 'archivees';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'toutes', label: 'Toutes' },
  { key: 'actives', label: 'Actives' },
  { key: 'attention', label: 'Réforme' },
  { key: 'archivees', label: 'Archivées' },
];

export default function BandesScreen() {
  const [flocks, setFlocks] = useState(INITIAL_FLOCKS);
  const [filter, setFilter] = useState<FilterKey>('toutes');
  const [menuFlock, setMenuFlock] = useState<Flock | null>(null);
  const [search, setSearch] = useState('');
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [selectedEventType, setSelectedEventType] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Formulaire de création
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [breed, setBreed] = useState('ISA Brown');
  const [breedPresets, setBreedPresets] = useState<string[]>(PRESET_BREEDS);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmId, setFarmId] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [birdCount, setBirdCount] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [canCreateFlock, setCanCreateFlock] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 2800);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    setLoading(true);
    Promise.all([listFlocks(true), listFarms(), listFlockRacePresets(), listEvents()]).then(([items, farmItems, presets, eventItems]) => {
      setFarms(farmItems);
      if (farmItems[0]) setFarmId(String(farmItems[0].id));
      const farmNames = new Map(farmItems.map((farm) => [farm.id, farm.name]));
      const farmIds = new Set(farmItems.map((farm) => farm.id));
      const names = presets.map((preset) => preset.name).filter(Boolean);
      const uniqueTypes = Array.from(new Set(eventItems.filter((event) => event.status === 'pending').map((event) => event.type).filter(Boolean))).map((type) => type);
      setEventTypes(uniqueTypes);
      setBreedPresets(names.length > 0 ? names : PRESET_BREEDS);
      setFlocks(items.filter((flock) => farmIds.has(flock.farm_id)).map((flock: ApiFlock) => ({
        id: String(flock.id), farmId: flock.farm_id, name: flock.name || `Bande ${flock.id} • ${farmNames.get(flock.farm_id) || 'Ferme'}`,
        breed: flock.breed || 'Race non précisée', start: flock.start_date || new Date().toISOString(),
        birdCount: flock.bird_count, archived: flock.archived,
      })));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const map = new Map<number, string[]>();
    listEvents().then((items) => {
      items.filter((event: Event) => event.status === 'pending').forEach((event: Event) => {
        if (!event.flock_id) return;
        const current = map.get(event.flock_id) ?? [];
        if (!current.includes(event.type)) current.push(event.type);
        map.set(event.flock_id, current);
      });
      setFlocks((previous) => previous.map((flock) => ({
        ...flock,
        eventTypes: map.get(Number(flock.id)) ?? [],
      })));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => setIsOnline(state.isConnected ?? true));
    return unsub;
  }, []);

  useEffect(() => {
    if (!farmId) {
      setCanCreateFlock(false);
      return;
    }
    getFarmPermissionState(Number(farmId)).then((permissions) => setCanCreateFlock(permissions.create_flock)).catch(() => setCanCreateFlock(false));
  }, [farmId]);

  const isReformSoon = (f: Flock) => {
    const isLayer = f.breed.toLowerCase().includes('pondeuses');
    return isLayer && computeAge(f.start).weeks >= 75; // CDC §2.7 : réforme 80-90 sem
  };

  const filtered = useMemo(() => {
    return flocks.filter((f) => {
      if (filter === 'archivees') return f.archived;
      if (f.archived) return false;
      if (search.trim() && !`${f.name} ${f.breed}`.toLowerCase().includes(search.trim().toLowerCase())) return false;
      if (selectedEventType !== 'all') {
        const flockEventTypes = f.eventTypes ?? [];
        if (!flockEventTypes.includes(selectedEventType)) return false;
      }
      if (filter === 'actives') return !isReformSoon(f);
      if (filter === 'attention') return isReformSoon(f);
      return true;
    });
  }, [flocks, filter, search, selectedEventType]);

  const handleCreate = async () => {
    const e: Record<string, string> = {};
    if (!farmId) e.farm = 'La ferme est obligatoire.';
    const count = parseInt(birdCount, 10);
    if (!birdCount.trim() || isNaN(count) || count <= 0) e.birdCount = "L'effectif initial doit être supérieur à zéro.";
    if (startDate.getTime() > Date.now()) e.date = 'La date de début ne peut pas être dans le futur.';
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    try {
      const selectedFarm = farms.find((farm) => String(farm.id) === farmId);
      if (!selectedFarm) throw new Error('Aucune ferme disponible pour cette bande.');
      const normalizedName = name.trim() || `Bande ${Date.now().toString().slice(-4)}`;
      const payload = { farm_id: selectedFarm.id, name: normalizedName, breed: breed.trim() || 'ISA Brown', bird_count: count, start_date: startDate.toISOString().slice(0, 10) };

      if (!isOnline) {
        const localId = -Date.now();
        await enqueueOfflineItem({ type: 'flock', createdAt: Date.now(), local_id: localId, farm_id: selectedFarm.id, name: normalizedName, bird_count: count, breed: payload.breed, start_date: payload.start_date });
        setFlocks((current) => [...current, {
          id: String(localId),
          farmId: selectedFarm.id,
          name: normalizedName,
          breed: payload.breed,
          start: payload.start_date,
          birdCount: count,
          archived: false,
        }]);
        setShowCreate(false); setName(''); setBreed('ISA Brown'); setBirdCount(''); setStartDate(new Date());
        Alert.alert('Mode hors-ligne', 'Bande enregistrée localement. Elle sera synchronisée au retour du réseau.', [{ text: 'OK' }]);
        return;
      }

      const flock = await createFlock(payload);
      setFlocks((p) => [...p, { id: String(flock.id), farmId: flock.farm_id, name: flock.name || normalizedName, breed: flock.breed || breed.trim(), start: flock.start_date || startDate.toISOString(), birdCount: flock.bird_count, archived: false }]);
      setShowCreate(false); setName(''); setBreed('ISA Brown'); setBirdCount(''); setStartDate(new Date());
      setToast('Bande créée avec succès.');
    } catch (error) {
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Impossible de créer la bande.');
    } finally {
      setSaving(false);
    }
  };

  const archiveFlock = (f: Flock) => {
    Alert.alert(
      f.archived ? 'Réactiver cette bande ?' : 'Désactiver cette bande ?',
      f.archived ? `${f.name} redeviendra accessible.` : `${f.name} ne sera plus accessible aux membres. Les données sont conservées.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: f.archived ? 'Réactiver' : 'Désactiver', onPress: async () => {
          try { await updateFlock(Number(f.id), { archived: !f.archived }); setFlocks((p) => p.map((x) => (x.id === f.id ? { ...x, archived: !f.archived } : x))); }
          catch (error) { Alert.alert('Erreur', error instanceof Error ? error.message : 'Impossible de modifier la bande.'); }
        } },
      ]
    );
  };

  const onDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selected) setStartDate(selected);
  };

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Bandes" onBack={() => router.back()} />

      {toast !== '' && (
        <View style={styles.toast}>
          <MaterialIcons name="check-circle" size={16} color={Colors.primary} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {FILTERS.map((f) => (
          <TouchableOpacity key={f.key} style={[styles.chip, filter === f.key && styles.chipActive]} onPress={() => setFilter(f.key)}>
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
        {eventTypes.length > 0 && (
          <TouchableOpacity style={[styles.chip, selectedEventType === 'all' && styles.chipActive]} onPress={() => setSelectedEventType('all')}>
            <Text style={[styles.chipText, selectedEventType === 'all' && styles.chipTextActive]}>Tous événements</Text>
          </TouchableOpacity>
        )}
        {eventTypes.map((eventType) => (
          <TouchableOpacity
            key={eventType}
            style={[styles.chip, selectedEventType === eventType && styles.chipActive]}
            onPress={() => setSelectedEventType(eventType)}
          >
            <Text style={[styles.chipText, selectedEventType === eventType && styles.chipTextActive]}>{eventType}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.searchBox}>
        <MaterialIcons name="search" size={20} color={Colors.onSurfaceVariant} />
        <TextInput placeholder="Rechercher une bande ou une ferme" value={search} onChangeText={setSearch} style={styles.searchInput} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Gérez vos lots de volailles en cours.</Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={Colors.primary} size="small" />
            <Text style={styles.loadingText}>Chargement des bandes…</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="flutter-dash" size={44} color={Colors.outline} />
            <Text style={styles.emptyTitle}>Aucune bande dans ce filtre</Text>
            <Text style={styles.emptyText}>Créez une nouvelle bande avec le bouton + en bas à droite.</Text>
          </View>
        ) : (
          filtered.map((b) => {
            const age = computeAge(b.start);
            const warning = isReformSoon(b);
            const eventTypeTags = b.eventTypes ?? [];
            return (
              <TouchableOpacity
                key={b.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => router.push(`/bandes/${b.id}` as Href)}
              >
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name}>{b.name}</Text>
                      {warning ? (
                        <View style={styles.pillWarning}>
                          <MaterialIcons name="elderly" size={11} color={Colors.warning} />
                          <Text style={styles.pillWarningText}>Réforme proche</Text>
                        </View>
                      ) : (
                        <View style={styles.pillActive}>
                          <Text style={styles.pillActiveText}>Active</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.breed}>{b.breed}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setMenuFlock(b)} hitSlop={8}>
                    <MaterialIcons name="more-vert" size={20} color={Colors.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>

                {eventTypeTags.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eventTagRow}>
                    {eventTypeTags.map((eventType) => (
                      <View key={eventType} style={styles.eventPill}>
                        <Text style={styles.eventPillText}>{eventType}</Text>
                      </View>
                    ))}
                  </ScrollView>
                )}

                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Effectif</Text>
                    <Text style={styles.statValue}>{formatNumber(b.birdCount)}</Text>
                  </View>
                  <View style={[styles.statBox, warning && styles.statBoxWarning]}>
                    <Text style={[styles.statLabel, warning && { color: Colors.error }]}>Âge</Text>
                    <Text style={styles.statValue}>
                      {age.value} <Text style={styles.statUnit}>{age.unit}</Text>
                    </Text>
                  </View>
                </View>

                {warning && (
                  <Text style={styles.reformNote}>
                    Réforme recommandée entre 80 et 90 semaines (CDC §2.7).
                  </Text>
                )}

                <View style={styles.footer}>
                  <MaterialIcons name="calendar-month" size={16} color={Colors.onSurfaceVariant} />
                  <Text style={styles.footerText}>Début : {formatFr(b.start)}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* FAB → ouvre le formulaire de création */}
      {canCreateFlock && (
        <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => setShowCreate(true)}>
          <MaterialIcons name="add" size={26} color={Colors.onPrimaryContainer} />
        </TouchableOpacity>
      )}

      {/* ---------- MODAL ACTIONS (kebab) ---------- */}
      <Modal transparent animationType="fade" visible={!!menuFlock} onRequestClose={() => setMenuFlock(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {menuFlock && (
              <>
                <Text style={styles.modalTitle}>{menuFlock.name}</Text>
                <TouchableOpacity style={styles.actionRow} onPress={() => { router.push(`/bandes/${menuFlock.id}` as Href); setMenuFlock(null); }}>
                  <MaterialIcons name="visibility" size={20} color={Colors.onSurfaceVariant} />
                  <Text style={styles.actionText}>Voir le détail</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionRow} onPress={() => { archiveFlock(menuFlock); setMenuFlock(null); }}>
                  <MaterialIcons name="archive" size={20} color={Colors.error} />
                  <Text style={[styles.actionText, { color: Colors.error }]}>Archiver la bande</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMenuFlock(null)} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Annuler</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ---------- MODAL CRÉATION DE BANDE (POST /flocks) ---------- */}
      <Modal transparent animationType="slide" visible={showCreate} onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nouvelle bande</Text>
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
              <Text style={styles.label}>Ferme</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.farmChoices}>
                {farms.map((farm) => <TouchableOpacity key={farm.id} style={[styles.choice, farmId === String(farm.id) && styles.choiceActive]} onPress={() => { setFarmId(String(farm.id)); setErrors({ ...errors, farm: '' }); }}><Text style={[styles.choiceText, farmId === String(farm.id) && styles.choiceTextActive]}>{farm.name}</Text></TouchableOpacity>)}
              </ScrollView>
              {errors.farm && <Text style={styles.errorText}>{errors.farm}</Text>}
              <FormField label="Nom de la bande" icon="label" placeholder="Bande A" value={name} onChangeText={(t) => { setName(t); if (errors.name) setErrors({ ...errors, name: '' }); }} />
              <Text style={styles.label}>Race</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
                {breedPresets.map((preset) => (
                  <TouchableOpacity key={preset} style={[styles.presetChip, breed === preset && styles.presetChipActive]} onPress={() => setBreed(preset)}>
                    <Text style={[styles.presetChipText, breed === preset && styles.presetChipTextActive]}>{preset}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <FormField label="Race personnalisée" icon="pets" placeholder="ISA Brown" value={breed} onChangeText={(t) => { setBreed(t); if (errors.breed) setErrors({ ...errors, breed: '' }); }} />
              {errors.breed !== '' && errors.breed !== undefined && <Text style={styles.errorText}>{errors.breed}</Text>}

              <Text style={styles.label}>Date de début</Text>
              <TouchableOpacity style={styles.dateBox} onPress={() => setShowPicker(true)} activeOpacity={0.8}>
                <MaterialIcons name="calendar-today" size={16} color={Colors.onSurfaceVariant} />
                <Text style={styles.dateText}>{formatFr(startDate.toISOString())}</Text>
              </TouchableOpacity>
              {errors.date !== '' && errors.date !== undefined && <Text style={styles.errorText}>{errors.date}</Text>}
              {showPicker && (
                <View style={{ marginTop: 8 }}>
                  <DateTimePicker value={startDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} maximumDate={new Date()} onChange={onDateChange} />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity onPress={() => setShowPicker(false)} style={styles.pickerClose}>
                      <Text style={styles.pickerCloseText}>Fermer</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <Text style={styles.label}>Effectif initial</Text>
              <View style={styles.inputRow}>
                <TextInput style={styles.inputRight} keyboardType="number-pad" placeholder="0" value={birdCount} onChangeText={(t) => { setBirdCount(t); if (errors.birdCount) setErrors({ ...errors, birdCount: '' }); }} />
                <Text style={styles.inputSuffix}>sujets</Text>
              </View>
              {errors.birdCount !== '' && errors.birdCount !== undefined && <Text style={styles.errorText}>{errors.birdCount}</Text>}

              <PrimaryButton label={saving ? 'Création...' : 'Créer la bande'} icon={saving ? undefined : 'add'} onPress={handleCreate} disabled={saving} style={{ marginTop: 8 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  toast: { position: 'absolute', top: 12, left: 16, right: 16, zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(13,99,27,0.12)', borderRadius: Radius.DEFAULT, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(13,99,27,0.2)' },
  toastText: { color: Colors.primary, fontSize: 12.5, fontWeight: '700', flexShrink: 1 },
  searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.containerPadding, marginBottom: 8, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.DEFAULT, backgroundColor: Colors.surfaceContainerLowest },
  searchInput: { flex: 1, marginLeft: 8, color: Colors.onSurface },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.containerPadding, paddingVertical: 12 },
  chip: { minWidth: 96, height: 36, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerHigh, borderWidth: 1, borderColor: Colors.outlineVariant, justifyContent: 'center', alignItems: 'center' },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Typography.labelLg, color: Colors.onSurfaceVariant },
  chipTextActive: { color: Colors.onPrimary },
  eventTagRow: { flexDirection: 'row', gap: 8, marginBottom: 12, paddingRight: 4 },
  eventPill: { backgroundColor: 'rgba(13,99,27,0.10)', borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 4, minHeight: 24, justifyContent: 'center' },
  eventPillText: { color: Colors.primary, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  farmChoices: { gap: 8, paddingVertical: 4 },
  choice: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: Radius.DEFAULT, backgroundColor: Colors.surfaceContainerHigh, borderWidth: 1, borderColor: Colors.outlineVariant },
  choiceActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  choiceText: { color: Colors.onSurfaceVariant, fontWeight: '700', fontSize: 13 },
  choiceTextActive: { color: Colors.onPrimary },
  presetRow: { gap: 8, paddingVertical: 4 },
  presetChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerHigh, borderWidth: 1, borderColor: Colors.outlineVariant },
  presetChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  presetChipText: { color: Colors.onSurfaceVariant, fontSize: 12, fontWeight: '700' },
  presetChipTextActive: { color: Colors.onPrimary },
  scroll: { padding: Spacing.containerPadding, paddingBottom: 90 },
  subtitle: { color: Colors.onSurfaceVariant, marginBottom: 16 },
  loadingBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  loadingText: { color: Colors.onSurfaceVariant, fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: Colors.surfaceContainerLowest, borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.md, padding: 18, marginBottom: Spacing.gridGutter, ...Shadow.sm },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  name: { ...Typography.headlineMd, fontSize: 17, color: Colors.onSurface },
  pillActive: { backgroundColor: Colors.primaryContainer, paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  pillActiveText: { color: Colors.onPrimaryContainer, fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  pillWarning: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(217,119,6,0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  pillWarningText: { color: Colors.warning, fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  breed: { color: Colors.onSurfaceVariant, fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: Spacing.gridGutter, marginBottom: 12 },
  statBox: { flex: 1, backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.DEFAULT, borderWidth: 1, borderColor: Colors.outlineVariant, padding: 12 },
  statBoxWarning: { borderColor: 'rgba(186,26,26,0.3)', backgroundColor: 'rgba(255,218,214,0.2)' },
  statLabel: { fontSize: 11, color: Colors.onSurfaceVariant, marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: '800', color: Colors.onSurface },
  statUnit: { fontSize: 12, fontWeight: '400', color: Colors.onSurfaceVariant },
  reformNote: { color: Colors.error, fontSize: 12, marginBottom: 10, fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: Colors.outlineVariant, paddingTop: 10 },
  footerText: { color: Colors.onSurfaceVariant, fontSize: 13 },
  empty: { alignItems: 'center', paddingVertical: 50, gap: 8 },
  emptyTitle: { ...Typography.headlineMd, fontSize: 17, color: Colors.onSurface },
  emptyText: { fontSize: 13, color: Colors.onSurfaceVariant, textAlign: 'center', maxWidth: 260 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center', ...Shadow.lg },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '86%', width: '100%', backgroundColor: Colors.surfaceContainerLowest, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, paddingTop: 10, paddingBottom: 24, gap: 12 },
  modalHandle: { width: 42, height: 5, borderRadius: 999, backgroundColor: Colors.outlineVariant, alignSelf: 'center', marginBottom: 4 },
  modalScroll: { maxHeight: '100%' },
  modalScrollContent: { paddingHorizontal: Spacing.containerPadding, paddingBottom: 12, gap: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.containerPadding },
  modalTitle: { ...Typography.headlineMd, fontSize: 20, color: Colors.onSurface },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  actionText: { fontSize: 15, fontWeight: '600', color: Colors.onSurface },
  cancelBtn: { paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: Colors.onSurfaceVariant, fontWeight: '600' },
  label: { ...Typography.labelLg, fontSize: 12, color: Colors.onSurfaceVariant, marginBottom: 6 },
  dateBox: { height: Spacing.touchTargetMin, borderWidth: 1.5, borderColor: Colors.outline, borderRadius: Radius.md, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateText: { color: Colors.onSurface, fontSize: 14, fontWeight: '600' },
  pickerClose: { alignItems: 'center', paddingVertical: 8 },
  pickerCloseText: { color: Colors.primary, fontWeight: '700' },
  inputRow: { height: Spacing.touchTargetMin, borderWidth: 1.5, borderColor: Colors.outline, borderRadius: Radius.md, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inputRight: { flex: 1, textAlign: 'right', fontSize: 16, color: Colors.onSurface },
  inputSuffix: { marginLeft: 8, color: Colors.onSurfaceVariant, fontWeight: '600', fontSize: 13 },
  errorText: { color: Colors.error, fontSize: 12, marginTop: -6, marginBottom: 8, marginLeft: 4 },
});