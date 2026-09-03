import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { listDailyReports, listEvents, type DailyReport, type Event } from '@/lib/api';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/design-system';
import { SubScreenHeader } from '@/components/ui/SubScreenHeader';

export default function AuditScreen() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    Promise.all([listDailyReports(), listEvents()]).then(([dailyReports, farmEvents]) => {
      setReports(dailyReports);
      setEvents(farmEvents);
    }).catch(() => {});
  }, []);

  const entries = [
    ...reports.map((report) => ({ id: `report-${report.id}`, title: 'Rapport quotidien enregistré', detail: `${report.eggs_produced} œufs • ${report.report_date}`, icon: 'assessment' as const })),
    ...events.map((event) => ({ id: `event-${event.id}`, title: event.title, detail: `${event.type} • ${new Date(event.event_date).toLocaleDateString()}`, icon: 'event' as const })),
  ].slice(0, 50);

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Audit & Historique" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.subtitle}>Les dernières opérations visibles sur vos fermes.</Text>
        {entries.length === 0 ? (
          <View style={styles.empty}><MaterialIcons name="history" size={48} color={Colors.outline} /><Text style={styles.emptyTitle}>Aucun historique</Text><Text style={styles.emptyText}>Les rapports et événements apparaîtront ici.</Text></View>
        ) : entries.map((entry) => (
          <View key={entry.id} style={styles.row}>
            <View style={styles.icon}><MaterialIcons name={entry.icon} size={20} color={Colors.primary} /></View>
            <View style={styles.copy}><Text style={styles.title}>{entry.title}</Text><Text style={styles.detail}>{entry.detail}</Text></View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.containerPadding, gap: 12 },
  subtitle: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.outlineVariant, ...Shadow.sm },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  title: { color: Colors.onSurface, fontWeight: '700', fontSize: 14 },
  detail: { color: Colors.onSurfaceVariant, fontSize: 12, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 70, gap: 8 },
  emptyTitle: { ...Typography.headlineMd, color: Colors.onSurface },
  emptyText: { color: Colors.onSurfaceVariant, textAlign: 'center' },
});
