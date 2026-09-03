// app/bandes/[id].tsx
import { FormField } from '@/components/ui/FormField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SubScreenHeader } from '@/components/ui/SubScreenHeader';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/design-system';
import { MaterialIcons } from '@expo/vector-icons';
import { Href, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { listDailyReports, listFlocks, type DailyReport } from '@/lib/api';
import { updateFlock } from '@/lib/api';

/* ================= HELPERS ================= */
const pad = (n: number) => String(n).padStart(2, '0');
const formatFr = (iso: string) => { const d = new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
const formatNumber = (v: number) => v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const fmtDec = (v: number, d = 1) => v.toFixed(d).replace('.', ',');
const ageWeeks = (start: string) => Math.floor((Date.now() - new Date(start).getTime()) / (7 * 86400000));

export default function BandeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [flock, setFlock] = useState<any>(null);
  const [reports, setReports] = useState<DailyReport[]>([]);

  useEffect(() => {
    if (!id) return;
    Promise.all([listFlocks(true), listDailyReports()]).then(([items, allReports]) => {
      const item = items.find((entry) => String(entry.id) === id);
      const flockReports = allReports.filter((report) => String(report.flock_id) === id);
      if (item) {
        const initial = item.initial_bird_count || item.bird_count;
        const mortCum = flockReports.reduce((total, report) => total + report.mortality, 0);
        const current = Math.max(0, item.bird_count);
        const eggs = flockReports.reduce((total, report) => total + report.eggs_produced, 0);
        setFlock({ id: item.id, name: item.name || `Bande ${item.id}`, breed: item.breed || 'Race non précisée', building: 'Ferme', start: item.start_date || new Date().toISOString(), initial, current, taux: initial > 0 ? (eggs / initial) * 100 : null, trend: 0, mortCum, archived: item.archived });
      }
      setReports(flockReports);
    }).catch(() => {});
  }, [id]);

  const [showEdit, setShowEdit] = useState(false);
  const [breed, setBreed] = useState(flock?.breed ?? '');
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState<{ breed: string; current: number } | null>(null);

  if (!flock) {
    return (
      <View style={styles.container}>
        <SubScreenHeader title="Détails de la Bande" onBack={() => router.back()} />
        <View style={styles.empty}>
          <MaterialIcons name="error-outline" size={44} color={Colors.outline} />
          <Text style={styles.emptyTitle}>Bande introuvable</Text>
          <PrimaryButton label="Retour aux bandes" onPress={() => router.back()} style={{ marginTop: 16 }} />
        </View>
      </View>
    );
  }

  const breedShown = edited?.breed ?? flock.breed;
  const currentShown = edited?.current ?? flock.current;
  const weeks = ageWeeks(flock.start);
  const isLayer = breedShown.toLowerCase().includes('pondeuses');
  const reformSoon = isLayer && weeks >= 75;
  const mortPct = flock.initial > 0 ? (flock.mortCum / flock.initial) * 100 : 0;
  const survivalPct = flock.initial > 0 ? (currentShown / flock.initial) * 100 : 0;
  const flockReports = reports;

  const handleEdit = async () => {
    if (!breed.trim()) {
      Alert.alert('Validation', 'Veuillez saisir une race valide.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateFlock(flock.id, { breed: breed.trim() });
      setEdited({ breed: updated.breed || breed.trim(), current: updated.bird_count });
    } catch (error) {
      setSaving(false);
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Impossible de modifier la bande.');
      return;
    }
    setSaving(false);
    setShowEdit(false);
    Alert.alert('Succès', 'Bande modifiée avec succès.');
  };

  const handleArchive = () => {
    const archived = Boolean(flock.archived);
    Alert.alert(archived ? 'Réactiver cette bande ?' : 'Désactiver cette bande ?', archived ? `${flock.name} redeviendra accessible.` : `${flock.name} ne sera plus accessible aux membres. Les données sont conservées.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: archived ? 'Réactiver' : 'Désactiver', onPress: async () => { try { await updateFlock(flock.id, { archived: !archived }); setFlock({ ...flock, archived: !archived }); } catch (error) { Alert.alert('Erreur', error instanceof Error ? error.message : 'Impossible de modifier la bande.'); } } },
    ]);
  };

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Détails de la Bande" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <View style={styles.activePill}>
            <Text style={styles.activePillText}>{flock.archived ? 'Désactivé' : 'Actif'}</Text>
          </View>
          <Text style={styles.building}>{flock.building}</Text>
        </View>
        <Text style={styles.title}>{flock.name} - {breedShown}</Text>
        <Text style={styles.subtitle}>Date de mise en place : {formatFr(flock.start)}</Text>

        {/* Prévision de réforme CDC §2.7 */}
        {reformSoon && (
          <View style={styles.reformBanner}>
            <MaterialIcons name="elderly" size={18} color={Colors.warning} />
            <Text style={styles.reformText}>
              {weeks} semaines — réforme recommandée entre 80 et 90 semaines.
            </Text>
          </View>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.outlineBtn} activeOpacity={0.8} onPress={() => setShowEdit(true)}>
            <MaterialIcons name="edit" size={16} color={Colors.secondary} />
            <Text style={styles.outlineBtnText}>Modifier</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.outlineBtn} activeOpacity={0.8} onPress={handleArchive}>
            <MaterialIcons name="archive" size={16} color={Colors.secondary} />
            <Text style={styles.outlineBtnText}>{flock.archived ? 'Réactiver' : 'Désactiver'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.kpiGrid}>
          <View style={styles.kpiCardHalf}>
            <Text style={styles.kpiLabel}>Âge actuel</Text>
            <Text style={styles.kpiValue}>{weeks}</Text>
            <Text style={[styles.kpiSub, { color: Colors.primary }]}>semaines</Text>
          </View>

          <View style={styles.kpiCardHalf}>
            <Text style={styles.kpiLabel}>Effectif actuel</Text>
            <Text style={styles.kpiValue}>{formatNumber(currentShown)}</Text>
            <Text style={styles.kpiSub}>/ {formatNumber(flock.initial)} initial</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(100, survivalPct)}%` }]} />
            </View>
          </View>

          <View style={styles.kpiCardHalf}>
            <Text style={styles.kpiLabel}>Production depuis création</Text>
            <Text style={styles.kpiValue}>{flock.taux !== null ? `${fmtDec(flock.taux)} %` : '—'}</Text>
            {flock.taux !== null && (
              <View style={styles.trendRow}>
                <MaterialIcons name={flock.trend >= 0 ? 'trending-up' : 'trending-down'} size={14} color={flock.trend >= 0 ? Colors.tertiary : Colors.error} />
                <Text style={[styles.kpiSub, { color: flock.trend >= 0 ? Colors.tertiary : Colors.error }]}>
                  {flock.trend >= 0 ? '+' : ''}{fmtDec(flock.trend)} % cette sem.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.kpiCardHalf}>
            <Text style={styles.kpiLabel}>Mortalité cumulée</Text>
            <Text style={[styles.kpiValue, { color: Colors.error }]}>{fmtDec(mortPct)} %</Text>
            <Text style={styles.kpiSub}>{formatNumber(flock.mortCum)} sujets</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(100, mortPct)}%`, backgroundColor: Colors.error }]} />
            </View>
          </View>
        </View>

        <View style={styles.reportsCard}>
          <View style={styles.reportsHeader}>
            <Text style={styles.reportsTitle}>Derniers rapports</Text>
            <TouchableOpacity style={styles.seeAllRow} onPress={() => router.push(`/(tabs)/rapports?flockId=${id}` as Href)}>
              <Text style={styles.seeAll}>Voir tout</Text>
              <MaterialIcons name="arrow-forward" size={16} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {flockReports.length === 0 ? (
            <View style={styles.reportsEmpty}>
              <Text style={styles.reportsEmptyText}>Aucune saisie pour cette bande pour le moment.</Text>
            </View>
          ) : (
            flockReports.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.reportItem}
                activeOpacity={0.8}
                onPress={() => router.push(`/(tabs)/rapports?flockId=${id}` as Href)}
              >
                <View style={styles.reportLeft}>
                  <View style={[styles.reportIcon, { backgroundColor: Colors.tertiaryContainer }]}>
                    <MaterialIcons name="receipt-long" size={20} color={Colors.onTertiaryContainer} />
                  </View>
                  <View>
                    <Text style={styles.reportTitle}>Rapport quotidien</Text>
                    <Text style={styles.reportMeta}>{formatFr(r.report_date)}</Text>
                  </View>
                </View>
                <View style={styles.reportRight}>
                    <Text style={[styles.reportValue, { color: Colors.primary }]}>{r.eggs_produced} œufs</Text>
                  <MaterialIcons name="chevron-right" size={18} color={Colors.onSurfaceVariant} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* MODAL ÉDITION */}
      <Modal transparent animationType="slide" visible={showEdit} onRequestClose={() => setShowEdit(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifier {flock.name}</Text>
              <TouchableOpacity onPress={() => setShowEdit(false)} hitSlop={10}>
                <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
            <FormField label="Race" icon="pets" value={breed} onChangeText={setBreed} />
            <View style={styles.readonlyField}>
              <Text style={styles.readonlyLabel}>Effectif actuel</Text>
              <Text style={styles.readonlyValue}>{formatNumber(currentShown)} sujets</Text>
              <Text style={styles.readonlyHint}>Calculé à partir de l’effectif initial moins les mortalités.</Text>
            </View>
            <PrimaryButton label={saving ? 'Enregistrement...' : 'Enregistrer'} onPress={handleEdit} disabled={saving} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.containerPadding, paddingBottom: 40 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  emptyTitle: { ...Typography.headlineMd, fontSize: 18, color: Colors.onSurface },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  activePill: { backgroundColor: Colors.primaryContainer, paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
  activePillText: { color: Colors.onPrimaryContainer, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  building: { color: Colors.onSurfaceVariant, fontSize: 13 },
  title: { ...Typography.headlineLg, fontSize: 21, color: Colors.onSurface, marginBottom: 4 },
  subtitle: { color: Colors.onSurfaceVariant, fontSize: 13, marginBottom: 16 },
  reformBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(217,119,6,0.1)', borderWidth: 1, borderColor: Colors.warning, borderRadius: Radius.md, padding: 12, marginBottom: 16 },
  reformText: { flex: 1, fontSize: 13, color: Colors.onSurface, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.secondary, borderRadius: Radius.DEFAULT, paddingHorizontal: 14, height: 42 },
  outlineBtnText: { color: Colors.secondary, fontWeight: '700', fontSize: 13 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.gridGutter, marginBottom: 24 },
  kpiCardHalf: { width: '48%', flexBasis: '48%', backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.outlineVariant, padding: 14, ...Shadow.sm },
  kpiLabel: { color: Colors.onSurfaceVariant, fontSize: 12, marginBottom: 8 },
  kpiValue: { fontSize: 24, fontWeight: '800', color: Colors.onSurface },
  kpiSub: { fontSize: 11, color: Colors.onSurfaceVariant, marginTop: 4, fontWeight: '600' },
  trendRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: Colors.surfaceVariant, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  reportsCard: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.outlineVariant, ...Shadow.sm, overflow: 'hidden' },
  reportsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant },
  reportsTitle: { ...Typography.headlineMd, fontSize: 16, color: Colors.onSurface },
  seeAllRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAll: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  reportsEmpty: { padding: 20, alignItems: 'center' },
  reportsEmptyText: { fontSize: 13, color: Colors.onSurfaceVariant },
  reportItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.surfaceVariant },
  reportLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  reportIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  reportTitle: { fontWeight: '600', fontSize: 13.5, color: Colors.onSurface },
  reportMeta: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 2 },
  reportRight: { gap: 4, flexDirection: 'row', alignItems: 'center' },
  reportValue: { fontWeight: '700', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.surfaceContainerLowest, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.containerPadding, paddingBottom: 40, gap: 14 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { ...Typography.headlineMd, fontSize: 20, color: Colors.onSurface },
  readonlyField: { borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.md, padding: 14, backgroundColor: Colors.surfaceContainerHigh, gap: 4 },
  readonlyLabel: { color: Colors.onSurfaceVariant, fontSize: 12, fontWeight: '700' },
  readonlyValue: { color: Colors.onSurface, fontSize: 18, fontWeight: '800' },
  readonlyHint: { color: Colors.onSurfaceVariant, fontSize: 11 },
});