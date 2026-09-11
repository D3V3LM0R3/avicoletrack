import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/design-system';
import { SubScreenHeader } from '@/components/ui/SubScreenHeader';
import { getFarmOverview, type FarmOverview } from '@/lib/api';

const PERIODS: { key: FarmOverview['period']; label: string }[] = [
  { key: '7d', label: '7 jours' },
  { key: '30d', label: '30 jours' },
  { key: '90d', label: '90 jours' },
  { key: 'year', label: 'Cette année' },
  { key: 'all', label: 'Tout' },
];

const formatNumber = (value: number) => new Intl.NumberFormat('fr-FR').format(Math.round(value));
const formatMonth = (value: string) => {
  const [year, month] = value.split('-').map(Number);
  if (!year || !month) return value;
  return new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
};

export default function FarmDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const farmId = Number(id);
  const [period, setPeriod] = useState<FarmOverview['period']>('30d');
  const [overview, setOverview] = useState<FarmOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    if (!Number.isFinite(farmId) || farmId <= 0) {
      setError('Cette ferme locale sera détaillée après sa synchronisation.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setOverview(await getFarmOverview(farmId, period));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Impossible de charger les résultats de cette ferme.');
    } finally {
      setLoading(false);
    }
  }, [farmId, period]);

  useFocusEffect(useCallback(() => { void loadOverview(); }, [loadOverview]));

  const maxProduction = Math.max(...(overview?.activity.map((item) => item.production) ?? [0]), 1);
  const maxMortality = Math.max(...(overview?.activity.map((item) => item.mortality) ?? [0]), 1);

  return (
    <View style={styles.container}>
      <SubScreenHeader title={overview?.farm.name ?? 'Détail de la ferme'} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading && <ActivityIndicator size="large" color={Colors.primary} style={styles.loader} />}
        {error && (
          <View style={styles.errorBox}>
            <MaterialIcons name="info-outline" size={20} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {!loading && overview && (
          <>
            <View style={styles.heading}>
              <View>
                <Text style={styles.title}>{overview.farm.name}</Text>
                <Text style={styles.location}>{overview.farm.location || 'Localisation non renseignée'}</Text>
              </View>
              <View style={[styles.status, !overview.farm.active && styles.statusInactive]}>
                <Text style={[styles.statusText, !overview.farm.active && styles.statusTextInactive]}>
                  {overview.farm.active ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Période d&apos;analyse</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periods}>
              {PERIODS.map((item) => (
                <TouchableOpacity key={item.key} style={[styles.period, period === item.key && styles.periodActive]} onPress={() => setPeriod(item.key)}>
                  <Text style={[styles.periodText, period === item.key && styles.periodTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.sectionTitle}>Stock actuel</Text>
            <View style={styles.grid}>
              <StockCard icon="inventory-2" label="Aliments" value={`${overview.stock.food_quantity} ${overview.stock.food_unit}`} detail={overview.stock.food_type || 'Type non renseigné'} />
              <StockCard icon="egg" label="Œufs" value={formatNumber(overview.stock.eggs)} detail="unités" />
              <StockCard icon="view-module" label="Alvéoles" value={formatNumber(overview.stock.alveoli)} detail="unités" />
              <StockCard icon="layers" label="Cartons" value={formatNumber(overview.stock.cartons)} detail="unités" />
            </View>

            <Text style={styles.sectionTitle}>Résultats de la période</Text>
            <View style={styles.grid}>
              <MetricCard icon="egg" label="Production" value={formatNumber(overview.results.production)} detail="œufs produits" color={Colors.tertiary} />
              <MetricCard icon="warning" label="Mortalité" value={formatNumber(overview.results.mortality)} detail="sujets" color={Colors.error} />
              <MetricCard icon="trending-up" label="Ponte moyenne" value={overview.results.average_laying_percentage === null ? '—' : `${overview.results.average_laying_percentage.toFixed(1)} %`} detail={`${overview.results.report_count} rapport${overview.results.report_count > 1 ? 's' : ''}`} color={Colors.primary} />
            </View>

            <View style={styles.highlights}>
              <Highlight icon="emoji-events" label="Meilleur mois de production" value={overview.highlights.best_production_month ? `${formatMonth(overview.highlights.best_production_month.month)} · ${formatNumber(overview.highlights.best_production_month.production)} œufs` : 'Pas encore de données'} />
              <Highlight icon="priority-high" label="Mois avec le plus de mortalité" value={overview.highlights.highest_mortality_month ? `${formatMonth(overview.highlights.highest_mortality_month.month)} · ${formatNumber(overview.highlights.highest_mortality_month.mortality)} sujets` : 'Pas encore de données'} danger />
            </View>

            <Text style={styles.sectionTitle}>Activité de la ferme</Text>
            <View style={styles.chartCard}>
              {overview.activity.length === 0 ? (
                <Text style={styles.emptyText}>Aucune activité enregistrée pour cette période.</Text>
              ) : overview.activity.map((item) => (
                <View key={item.label} style={styles.chartRow}>
                  <Text style={styles.chartLabel}>{formatMonth(item.label)}</Text>
                  <View style={styles.chartTracks}>
                    <View style={styles.track}><View style={[styles.bar, styles.productionBar, { width: `${(item.production / maxProduction) * 100}%` }]} /></View>
                    <View style={styles.track}><View style={[styles.bar, styles.mortalityBar, { width: `${(item.mortality / maxMortality) * 100}%` }]} /></View>
                  </View>
                  <View style={styles.chartValues}>
                    <Text style={styles.productionValue}>{formatNumber(item.production)}</Text>
                    <Text style={styles.mortalityValue}>{formatNumber(item.mortality)}</Text>
                  </View>
                </View>
              ))}
              {overview.activity.length > 0 && <View style={styles.legend}><Text style={styles.legendProduction}>Production</Text><Text style={styles.legendMortality}>Mortalité</Text></View>}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StockCard({ icon, label, value, detail }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string; detail: string }) {
  return <View style={styles.smallCard}><MaterialIcons name={icon} size={20} color={Colors.primary} /><Text style={styles.cardLabel}>{label}</Text><Text style={styles.cardValue}>{value}</Text><Text style={styles.cardDetail}>{detail}</Text></View>;
}

function MetricCard({ icon, label, value, detail, color }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string; detail: string; color: string }) {
  return <View style={styles.smallCard}><MaterialIcons name={icon} size={20} color={color} /><Text style={styles.cardLabel}>{label}</Text><Text style={[styles.cardValue, { color }]}>{value}</Text><Text style={styles.cardDetail}>{detail}</Text></View>;
}

function Highlight({ icon, label, value, danger = false }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; value: string; danger?: boolean }) {
  return <View style={[styles.highlight, danger && styles.highlightDanger]}><MaterialIcons name={icon} size={20} color={danger ? Colors.error : Colors.primary} /><View style={styles.highlightCopy}><Text style={styles.highlightLabel}>{label}</Text><Text style={styles.highlightValue}>{value}</Text></View></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.containerPadding, paddingBottom: 40 },
  loader: { marginTop: 40 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  title: { ...Typography.headlineLg, color: Colors.onSurface },
  location: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, marginTop: 3 },
  status: { backgroundColor: Colors.tertiaryContainer, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full },
  statusInactive: { backgroundColor: Colors.surfaceContainerHigh },
  statusText: { color: Colors.onTertiaryContainer, fontSize: 11, fontWeight: '700' },
  statusTextInactive: { color: Colors.onSurfaceVariant },
  sectionTitle: { color: Colors.onSurfaceVariant, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 18, marginBottom: 10 },
  periods: { gap: 8, paddingBottom: 2 },
  period: { borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.full, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: Colors.surfaceContainerLowest },
  periodActive: { backgroundColor: Colors.primaryContainer, borderColor: Colors.primary },
  periodText: { color: Colors.onSurfaceVariant, fontSize: 12, fontWeight: '700' },
  periodTextActive: { color: Colors.onPrimaryContainer },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  smallCard: { flex: 1, minWidth: '46%', backgroundColor: Colors.surfaceContainerLowest, borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.md, padding: 14, ...Shadow.sm },
  cardLabel: { color: Colors.onSurfaceVariant, fontSize: 12, fontWeight: '700', marginTop: 8 },
  cardValue: { color: Colors.onSurface, fontSize: 18, fontWeight: '800', marginTop: 4 },
  cardDetail: { color: Colors.outline, fontSize: 11, marginTop: 2 },
  highlights: { gap: 10, marginTop: 18 },
  highlight: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.primaryContainer, borderRadius: Radius.md, padding: 14 },
  highlightDanger: { backgroundColor: Colors.errorContainer },
  highlightCopy: { flex: 1 },
  highlightLabel: { color: Colors.onSurfaceVariant, fontSize: 11, fontWeight: '700' },
  highlightValue: { color: Colors.onSurface, fontSize: 14, fontWeight: '800', marginTop: 3 },
  chartCard: { backgroundColor: Colors.surfaceContainerLowest, borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.md, padding: 14, ...Shadow.sm },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 13 },
  chartLabel: { width: 68, color: Colors.onSurfaceVariant, fontSize: 11, fontWeight: '700' },
  chartTracks: { flex: 1, gap: 5 },
  track: { height: 7, backgroundColor: Colors.surfaceVariant, borderRadius: 4, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4, minWidth: 2 },
  productionBar: { backgroundColor: Colors.tertiary },
  mortalityBar: { backgroundColor: Colors.error },
  chartValues: { width: 54, alignItems: 'flex-end' },
  productionValue: { color: Colors.tertiary, fontSize: 10, fontWeight: '800' },
  mortalityValue: { color: Colors.error, fontSize: 10, fontWeight: '800' },
  legend: { flexDirection: 'row', gap: 16, borderTopWidth: 1, borderTopColor: Colors.surfaceVariant, paddingTop: 10, marginTop: 2 },
  legendProduction: { color: Colors.tertiary, fontSize: 11, fontWeight: '700' },
  legendMortality: { color: Colors.error, fontSize: 11, fontWeight: '700' },
  emptyText: { color: Colors.onSurfaceVariant, textAlign: 'center', paddingVertical: 22 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.errorContainer, borderRadius: Radius.md, padding: 14, marginTop: 18 },
  errorText: { flex: 1, color: Colors.onErrorContainer, fontSize: 13 },
});
