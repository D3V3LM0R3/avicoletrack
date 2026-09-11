import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { compareFarms, listFarms, type Farm, type FarmComparison } from '@/lib/api';
import { Colors, Spacing, Typography } from '@/constants/design-system';
import { SubScreenHeader } from '@/components/ui/SubScreenHeader';

export default function AnalyseScreen() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [rows, setRows] = useState<FarmComparison[]>([]);

  useEffect(() => {
    listFarms().then(async (items) => {
      setFarms(items);
      if (items.length) setRows(await compareFarms(items.map((farm) => farm.id)));
    }).catch(() => {});
  }, []);

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Analyse multi-fermes" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.subtitle}>{farms.length} ferme{farms.length > 1 ? 's' : ''} connectée{farms.length > 1 ? 's' : ''}</Text>
        {rows.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Graphiques comparatifs</Text>
            <ComparisonChart title="Effectif actuel" rows={rows} farms={farms} getValue={(row) => row.hens_reported} unit=" sujets" color={Colors.primary} />
            <ComparisonChart title="Production d'œufs" rows={rows} farms={farms} getValue={(row) => row.eggs} unit=" œufs" color={Colors.tertiary} />
            <ComparisonChart title="Taux de ponte" rows={rows} farms={farms} getValue={(row) => row.average_laying_percentage ?? 0} unit=" %" color="#2563EB" decimals />
            <ComparisonChart title="Mortalité" rows={rows} farms={farms} getValue={(row) => row.mortality} unit=" sujets" color={Colors.error} />
            <ComparisonChart title="Stock d'œufs" rows={rows} farms={farms} getValue={(row) => row.stock} unit=" œufs" color="#D97706" />
          </>
        )}
        <Text style={styles.sectionTitle}>Tableau détaillé</Text>
        <View style={styles.table}>
          <View style={[styles.row, styles.header]}><Text style={[styles.cell, styles.label]}>KPI</Text>{farms.map((farm) => <Text key={farm.id} style={[styles.cell, styles.label]}>{farm.name}</Text>)}</View>
          {[['Effectif', (row: FarmComparison) => row.hens_reported], ['Œufs', (row: FarmComparison) => row.eggs], ['Ponte', (row: FarmComparison) => row.average_laying_percentage == null ? '-' : `${row.average_laying_percentage.toFixed(1)} %`], ['Mortalité', (row: FarmComparison) => row.mortality], ['Stock', (row: FarmComparison) => row.stock]].map(([label, getter]) => (
            <View key={String(label)} style={styles.row}><Text style={[styles.cell, styles.label]}>{String(label)}</Text>{farms.map((farm) => { const row = rows.find((item) => item.farm_id === farm.id); return <Text key={farm.id} style={styles.cell}>{row ? String((getter as (value: FarmComparison) => number | string)(row)) : '-'}</Text>; })}</View>
          ))}
        </View>
        {!farms.length && <View style={styles.empty}><MaterialIcons name="insights" size={40} color={Colors.outline} /><Text style={styles.emptyText}>Créez une ferme pour commencer la comparaison.</Text></View>}
      </ScrollView>
    </View>
  );
}

function ComparisonChart({
  title,
  rows,
  farms,
  getValue,
  unit,
  color,
  decimals = false,
}: {
  title: string;
  rows: FarmComparison[];
  farms: Farm[];
  getValue: (row: FarmComparison) => number;
  unit: string;
  color: string;
  decimals?: boolean;
}) {
  const values = farms.map((farm) => getValue(rows.find((row) => row.farm_id === farm.id) ?? { farm_id: farm.id, hens_reported: 0, eggs: 0, average_laying_percentage: 0, mortality: 0, stock: 0 }));
  const maximum = Math.max(...values, 1);
  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>{title}</Text>
      {farms.map((farm, index) => {
        const value = values[index];
        return (
          <View key={farm.id} style={styles.chartRow}>
            <Text style={styles.chartFarmName} numberOfLines={1}>{farm.name}</Text>
            <View style={styles.chartTrack}><View style={[styles.chartBar, { width: `${(value / maximum) * 100}%`, backgroundColor: color }]} /></View>
            <Text style={styles.chartValue}>{decimals ? value.toFixed(1) : value.toLocaleString('fr-FR')}{unit}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.containerPadding, gap: 16 },
  subtitle: { ...Typography.bodyMd, color: Colors.onSurfaceVariant },
  sectionTitle: { color: Colors.onSurfaceVariant, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },
  chartCard: { backgroundColor: Colors.surfaceContainerLowest, borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: 12, padding: 14, gap: 12 },
  chartTitle: { color: Colors.onSurface, fontSize: 14, fontWeight: '800', marginBottom: 2 },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chartFarmName: { width: 82, color: Colors.onSurfaceVariant, fontSize: 11, fontWeight: '700' },
  chartTrack: { flex: 1, height: 10, backgroundColor: Colors.surfaceVariant, borderRadius: 5, overflow: 'hidden' },
  chartBar: { height: '100%', borderRadius: 5, minWidth: 2 },
  chartValue: { width: 68, color: Colors.onSurface, fontSize: 10, fontWeight: '800', textAlign: 'right' },
  table: { borderWidth: 1, borderColor: Colors.outlineVariant, backgroundColor: Colors.surfaceContainerLowest },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant, minHeight: 48, alignItems: 'center' },
  header: { backgroundColor: Colors.surfaceContainerHigh },
  cell: { flex: 1, paddingHorizontal: 8, color: Colors.onSurfaceVariant, fontSize: 12 },
  label: { color: Colors.onSurface, fontWeight: '700' },
  empty: { alignItems: 'center', padding: 32, gap: 12 },
  emptyText: { color: Colors.onSurfaceVariant, textAlign: 'center' },
});
