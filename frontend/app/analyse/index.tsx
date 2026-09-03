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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.containerPadding, gap: 16 },
  subtitle: { ...Typography.bodyMd, color: Colors.onSurfaceVariant },
  table: { borderWidth: 1, borderColor: Colors.outlineVariant, backgroundColor: Colors.surfaceContainerLowest },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant, minHeight: 48, alignItems: 'center' },
  header: { backgroundColor: Colors.surfaceContainerHigh },
  cell: { flex: 1, paddingHorizontal: 8, color: Colors.onSurfaceVariant, fontSize: 12 },
  label: { color: Colors.onSurface, fontWeight: '700' },
  empty: { alignItems: 'center', padding: 32, gap: 12 },
  emptyText: { color: Colors.onSurfaceVariant, textAlign: 'center' },
});
