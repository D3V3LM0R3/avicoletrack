import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { getCurrentUser, getFarmPermissionState, listDailyReports, listEvents, listFarms, listFlocks, listStockMovements, sendFarmNotification, type DailyReport, type Event, type Farm, type Flock, type StockMovement } from '@/lib/api';
import { exportExcelFile, exportPdfFile } from '@/lib/report-export';
import { Colors, Radius, Spacing, Typography } from '@/constants/design-system';
import { ScreenShell } from '@/components/ui/ScreenShell';

type ReportType = 'saisie' | 'mouvements' | 'evenements';
type ExportItem = DailyReport | StockMovement | Event;
type ExportTarget = { type: ReportType; items: ExportItem[] };
const labels: Record<ReportType, string> = { saisie: 'Saisies', mouvements: 'Mouvements', evenements: 'Événements' };
const formatDateTime = (value?: string | null) => value ? new Date(value).toLocaleString('fr-FR') : '—';
const reportStatus = (type: ReportType, item: ExportItem) => type === 'saisie' ? '—' : type === 'mouvements' ? ((item as StockMovement).status === 'validated' ? 'Confirmé' : 'Annulé') : ((item as Event).status === 'confirmed' ? 'Confirmé' : 'Annulé');
const personName = (name?: string | null, id?: number | null) => name ?? (id ? `Utilisateur #${id}` : '—');
const flockAgeWeeks = (startDate?: string | null, reportDate?: string) => {
  if (!startDate) return null;
  const start = new Date(startDate).getTime();
  const end = new Date(reportDate ?? Date.now()).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? Math.floor((end - start) / (7 * 86400000)) : null;
};

export default function ReportsScreen() {
  const { farmId, flockId } = useLocalSearchParams<{ farmId?: string; flockId?: string }>();
  const [reportType, setReportType] = useState<ReportType>('saisie');
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [role, setRole] = useState('WORKER');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [exportTarget, setExportTarget] = useState<ExportTarget | null>(null);
  const [selectedExportIds, setSelectedExportIds] = useState<number[]>([]);
  const [notificationReport, setNotificationReport] = useState<DailyReport | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const selectedFarm = farmId ? Number(farmId) : undefined;
      const [user, farmItems, flockItems, daily, movementItems, eventItems] = await Promise.all([getCurrentUser(), listFarms(), listFlocks(), listDailyReports(selectedFarm), listStockMovements(selectedFarm), listEvents()]);
      setRole(user?.role ?? 'WORKER');
      setFarms(farmItems);
      setFlocks(flockItems);
      setDailyReports(daily);
      setMovements(movementItems);
      setEvents(eventItems);
      const states = await Promise.all(farmItems.map((farm) => getFarmPermissionState(farm.id)));
      const owner = user?.role === 'OWNER';
      setPermissions({
        create_event: owner || states.some((state) => state.create_event),
        send_notification: owner || states.some((state) => state.send_notification),
        confirm_stock_movement: owner || states.some((state) => state.confirm_stock_movement),
        export_daily_reports: owner || states.some((state) => state.export_daily_reports),
        export_movement_reports: owner || states.some((state) => state.export_movement_reports),
        export_event_reports: owner || states.some((state) => state.export_event_reports),
      });
    } catch {
      setDailyReports([]);
      setMovements([]);
      setEvents([]);
      setFlocks([]);
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useEffect(() => { void load(); }, [load]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const farmName = useCallback((id: number) => farms.find((farm) => farm.id === id)?.name ?? `Ferme #${id}`, [farms]);
  const query = search.trim().toLowerCase();
  const daily = useMemo(() => dailyReports.filter((item) => (!flockId || String(item.flock_id) === flockId) && (!query || `${farmName(item.farm_id)} ${item.report_date} ${item.author_name ?? ''} ${item.notes ?? ''}`.toLowerCase().includes(query))), [dailyReports, flockId, query, farmName]);
  const movementRows = useMemo(() => movements.filter((item) => (item.status === 'validated' || item.status === 'cancelled') && (!query || `${farmName(item.farm_id)} ${item.stock_type} ${item.movement_type} ${item.status} ${item.note ?? ''}`.toLowerCase().includes(query))), [movements, query, farmName]);
  const eventRows = useMemo(() => events.filter((item) => (item.status === 'confirmed' || item.status === 'cancelled') && (!query || `${farmName(item.farm_id)} ${item.title} ${item.type} ${item.status} ${item.description ?? ''}`.toLowerCase().includes(query))), [events, query, farmName]);
  const canView = reportType === 'saisie' || role === 'OWNER' || (reportType === 'mouvements' ? !!permissions.confirm_stock_movement : !!permissions.create_event);
  const canExport = reportType === 'saisie' ? !!permissions.export_daily_reports : reportType === 'mouvements' ? !!permissions.export_movement_reports : !!permissions.export_event_reports;
  const visibleExportItems: ExportItem[] = reportType === 'saisie' ? daily : reportType === 'mouvements' ? movementRows : eventRows;

  const exportFields = (type: ReportType, item: ExportItem): { headers: string[]; values: unknown[] } => {
    if (type === 'saisie') {
      const report = item as DailyReport;
      const flock = flocks.find((candidate) => candidate.id === report.flock_id);
      const ageWeeks = report.hen_age ?? flockAgeWeeks(flock?.start_date, report.report_date);
      return { headers: ['Date', 'Effectif', 'Mortalité', 'Œufs produits', 'Âge des poules (semaines)', 'Stock œufs', 'Cartons', 'Alvéoles', 'Œufs restants', 'Aliments (kg)', 'Eau (L)', 'Créé par', 'Créé le'], values: [report.report_date, report.bird_count, report.mortality, report.eggs_produced, ageWeeks, report.egg_stock, report.cartons, report.alveoli, report.remaining_eggs, report.feed_used_bags, report.water_used_liters, personName(report.author_name ?? report.created_by_name, report.created_by), formatDateTime(report.created_at)] };
    }
    if (type === 'mouvements') {
      const movement = item as StockMovement;
      return { headers: ['ID', 'Ferme', 'Bande', 'Stock', 'Mouvement', 'Quantité', 'Unité', 'Date', 'Statut', 'Créé par', 'Traité le', 'Traité par', 'Note / message'], values: [movement.id, farmName(movement.farm_id), movement.flock_id, movement.stock_type, movement.movement_type, movement.quantity, movement.unit, formatDateTime(movement.movement_date ?? movement.created_at), reportStatus(type, movement), personName(movement.created_by_name, movement.created_by), formatDateTime(movement.validated_at), personName(movement.validated_by_name, movement.validated_by), movement.note ?? movement.confirmation_message] };
    }
    const event = item as Event;
    return { headers: ['ID', 'Ferme', 'Bande', 'Type', 'Titre', 'Date prévue', 'Rappel', 'Statut', 'Créé par', 'Créé le', 'Traité le', 'Traité par', 'Description / message'], values: [event.id, farmName(event.farm_id), event.flock_id, event.type, event.title, formatDateTime(event.event_date), formatDateTime(event.reminder_date), reportStatus(type, event), personName(undefined, event.created_by), formatDateTime(event.created_at), formatDateTime(event.confirmed_at), personName(event.confirmed_by_name, event.confirmed_by), event.description ?? event.confirmation_message] };
  };

  const selectExportItem = (type: ReportType, item: ExportItem) => {
    const id = item.id;
    if (id === undefined) return;
    setSelectedExportIds((current) => current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]);
  };

  const openExport = (type: ReportType, items: ExportItem[]) => {
    const selected = items.filter((item) => item.id !== undefined && selectedExportIds.includes(item.id));
    setExportTarget({ type, items: selected.length ? selected : items });
  };

  const exportPdf = async () => {
    if (!exportTarget?.items.length) return;
    try {
      const { type, items } = exportTarget;
      const { headers } = exportFields(type, items[0]);
      await exportPdfFile(labels[type], headers, items.map((item) => exportFields(type, item).values));
      setExportTarget(null);
      setSelectedExportIds([]);
    } catch (error) {
      Alert.alert('Export PDF impossible', error instanceof Error ? error.message : 'Le fichier PDF n’a pas pu être partagé.');
    }
  };

  const exportExcel = async () => {
    if (!exportTarget?.items.length) return;
    try {
      const { type, items } = exportTarget;
      const first = exportFields(type, items[0]);
      const rows = [first.headers, ...items.map((item) => exportFields(type, item).values)];
      await exportExcelFile(labels[type], type, first.headers, rows.slice(1));
      setExportTarget(null);
      setSelectedExportIds([]);
    } catch (error) {
      Alert.alert('Export Excel impossible', error instanceof Error ? error.message : 'Le fichier CSV n’a pas pu être partagé.');
    }
  };

  const notify = async () => {
    if (!notificationReport || !message.trim()) return;
    try { await sendFarmNotification(notificationReport.farm_id, 'Message concernant un rapport', message.trim()); setNotificationReport(null); setMessage(''); Alert.alert('Envoyé', 'La notification a été envoyée.'); } catch (error) { Alert.alert('Erreur', error instanceof Error ? error.message : 'Envoi impossible.'); }
  };

  const dailyCard = (report: DailyReport) => <View key={report.id} style={styles.card}>
    <Text style={styles.cardTitle}>{farmName(report.farm_id)} • {report.report_date}</Text>
    <Text style={styles.detail}>Effectif: {report.bird_count} • Mortalité: {report.mortality} • Œufs: {report.eggs_produced}</Text>
    <Text style={styles.detail}>Aliments: {report.feed_used_bags ?? 0} kg • Eau: {report.water_used_liters ?? 0} L</Text>
    <Text style={styles.detail}>Créé par: {personName(report.author_name ?? report.created_by_name, report.created_by)}</Text>
    <Text style={styles.detail}>Créé le: {formatDateTime(report.created_at)}</Text>
    <Text style={styles.detail}>{report.notes || 'Aucune observation.'}</Text>
    <View style={styles.actions}>{permissions.send_notification && <TouchableOpacity style={styles.action} onPress={() => setNotificationReport(report)}><MaterialIcons name="send" size={17} color={Colors.primary} /><Text style={styles.actionText}>Notifier</Text></TouchableOpacity>}{permissions.create_event && <TouchableOpacity style={styles.action} onPress={() => router.push({ pathname: '/evenements', params: { farmId: String(report.farm_id), flockId: String(report.flock_id ?? '') } })}><MaterialIcons name="event" size={17} color={Colors.primary} /><Text style={styles.actionText}>Événement</Text></TouchableOpacity>}{(role === 'OWNER' || permissions.confirm_stock_movement) && <TouchableOpacity style={styles.action} onPress={() => router.push({ pathname: '/stocks/mouvement', params: { farmId: String(report.farm_id), flockId: String(report.flock_id ?? '') } })}><MaterialIcons name="swap-horiz" size={17} color={Colors.primary} /><Text style={styles.actionText}>Mouvement</Text></TouchableOpacity>}</View>
    {permissions.export_daily_reports && <TouchableOpacity style={styles.exportLink} onPress={() => selectExportItem('saisie', report)}><MaterialIcons name={selectedExportIds.includes(report.id ?? -1) ? 'check-box' : 'check-box-outline-blank'} size={17} color={Colors.primary} /><Text style={styles.actionText}>Sélectionner</Text></TouchableOpacity>}
  </View>;

  return <ScreenShell activeTab="rapports"><ScrollView contentContainerStyle={styles.scroll}><Text style={styles.title}>Rapports</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{(Object.keys(labels) as ReportType[]).map((key) => <TouchableOpacity key={key} style={[styles.tab, reportType === key && styles.tabActive]} onPress={() => { setReportType(key); setSelectedExportIds([]); }}><Text style={[styles.tabText, reportType === key && styles.tabTextActive]}>{labels[key]}</Text></TouchableOpacity>)}</ScrollView><View style={styles.search}><MaterialIcons name="search" size={18} color={Colors.outline} /><TextInput style={styles.searchInput} placeholder="Rechercher..." value={search} onChangeText={setSearch} /></View>{canView && canExport && visibleExportItems.length > 0 && <View style={styles.exportToolbar}><Text style={styles.selectionText}>{selectedExportIds.length} sélectionné(s)</Text><TouchableOpacity onPress={() => setSelectedExportIds(visibleExportItems.flatMap((item) => item.id === undefined ? [] : [item.id]))}><Text style={styles.toolbarAction}>Tout sélectionner</Text></TouchableOpacity><TouchableOpacity style={styles.exportButton} onPress={() => openExport(reportType, visibleExportItems)}><MaterialIcons name="file-download" size={18} color={Colors.onPrimary} /><Text style={styles.exportText}>Exporter</Text></TouchableOpacity></View>}{loading ? <ActivityIndicator color={Colors.primary} /> : !canView ? <Text style={styles.empty}>Vous n’avez pas l’autorisation de consulter ce rapport.</Text> : reportType === 'saisie' ? daily.map(dailyCard) : reportType === 'mouvements' ? movementRows.map((item) => <View key={item.id} style={styles.card}><Text style={styles.cardTitle}>{farmName(item.farm_id)} • {item.stock_type}</Text><Text style={styles.detail}>{formatDateTime(item.movement_date ?? item.created_at)} • {item.movement_type} • {item.quantity} {item.unit}</Text><Text style={styles.status}>{item.status === 'validated' ? 'Confirmé' : item.status === 'cancelled' ? 'Annulé' : 'En attente'}</Text><Text style={styles.detail}>Traité le: {formatDateTime(item.validated_at)} • Par: {item.validated_by ?? '—'}</Text><Text style={styles.detail}>{item.note || item.confirmation_message || 'Aucun détail.'}</Text>{permissions.export_movement_reports && <TouchableOpacity style={styles.exportLink} onPress={() => selectExportItem('mouvements', item)}><MaterialIcons name={selectedExportIds.includes(item.id ?? -1) ? 'check-box' : 'check-box-outline-blank'} size={17} color={Colors.primary} /><Text style={styles.actionText}>Sélectionner</Text></TouchableOpacity>}</View>) : eventRows.map((item) => <View key={item.id} style={styles.card}><Text style={styles.cardTitle}>{farmName(item.farm_id)} • {item.title}</Text><Text style={styles.detail}>{formatDateTime(item.event_date)} • {item.type}</Text><Text style={styles.status}>{item.status === 'confirmed' ? 'Confirmé' : item.status === 'cancelled' ? 'Annulé' : 'En attente'}</Text><Text style={styles.detail}>Traité le: {formatDateTime(item.confirmed_at)} • Par: {item.confirmed_by ?? '—'}</Text><Text style={styles.detail}>{item.description || item.confirmation_message || 'Aucun détail.'}</Text>{permissions.export_event_reports && <TouchableOpacity style={styles.exportLink} onPress={() => selectExportItem('evenements', item)}><MaterialIcons name={selectedExportIds.includes(item.id ?? -1) ? 'check-box' : 'check-box-outline-blank'} size={17} color={Colors.primary} /><Text style={styles.actionText}>Sélectionner</Text></TouchableOpacity>}</View>)}<Modal transparent visible={!!exportTarget} onRequestClose={() => setExportTarget(null)}><View style={styles.overlay}><View style={styles.modal}><Text style={styles.modalTitle}>Options d’export ({exportTarget?.items.length ?? 0})</Text><TouchableOpacity style={styles.option} onPress={() => void exportPdf()}><MaterialIcons name="picture-as-pdf" size={21} color={Colors.primary} /><Text style={styles.optionText}>PDF</Text></TouchableOpacity><TouchableOpacity style={styles.option} onPress={() => void exportExcel()}><MaterialIcons name="table-chart" size={21} color={Colors.primary} /><Text style={styles.optionText}>Excel (CSV)</Text></TouchableOpacity><TouchableOpacity onPress={() => setExportTarget(null)}><Text style={styles.cancel}>Annuler</Text></TouchableOpacity></View></View></Modal><Modal transparent visible={!!notificationReport} onRequestClose={() => setNotificationReport(null)}><View style={styles.overlay}><View style={styles.modal}><Text style={styles.modalTitle}>Notifier la ferme</Text><TextInput style={styles.input} placeholder="Message à envoyer" value={message} onChangeText={setMessage} multiline /><TouchableOpacity style={styles.exportButton} onPress={() => void notify()}><Text style={styles.exportText}>Envoyer</Text></TouchableOpacity><TouchableOpacity onPress={() => setNotificationReport(null)}><Text style={styles.cancel}>Annuler</Text></TouchableOpacity></View></View></Modal></ScrollView></ScreenShell>;
}


const styles = StyleSheet.create({ scroll: { padding: Spacing.containerPadding, paddingBottom: 120, gap: 14 }, title: { ...Typography.headlineLg, color: Colors.onSurface }, tabs: { gap: 8 }, tab: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainer }, tabActive: { backgroundColor: Colors.primary }, tabText: { color: Colors.onSurfaceVariant, fontWeight: '700' }, tabTextActive: { color: Colors.onPrimary }, search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.md, paddingHorizontal: 12, height: 44 }, searchInput: { flex: 1, color: Colors.onSurface }, exportToolbar: { flexDirection: 'row', alignItems: 'center', gap: 10 }, selectionText: { color: Colors.onSurfaceVariant, fontSize: 12, fontWeight: '700', flex: 1 }, toolbarAction: { color: Colors.primary, fontSize: 12, fontWeight: '700' }, card: { gap: 6, padding: 14, borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.md, backgroundColor: Colors.surfaceContainerLowest }, cardTitle: { ...Typography.titleMedium, color: Colors.onSurface }, detail: { ...Typography.bodySmall, color: Colors.onSurfaceVariant, flexShrink: 1 }, status: { color: Colors.primary, fontWeight: '800' }, actions: { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: Colors.outlineVariant, paddingTop: 10 }, action: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }, actionText: { color: Colors.primary, fontWeight: '700', fontSize: 12 }, exportLink: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingTop: 8 }, empty: { color: Colors.onSurfaceVariant, textAlign: 'center', padding: 30 }, exportButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 13, borderRadius: Radius.md, backgroundColor: Colors.primary }, exportText: { color: Colors.onPrimary, fontWeight: '800' }, overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.45)' }, modal: { backgroundColor: Colors.surfaceContainerLowest, padding: Spacing.containerPadding, gap: 14, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg }, modalTitle: { ...Typography.titleLarge, color: Colors.onSurface }, option: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: Radius.md, backgroundColor: Colors.surfaceContainer }, optionText: { color: Colors.onSurface, fontWeight: '700' }, input: { minHeight: 90, borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.md, padding: 12, color: Colors.onSurface }, cancel: { textAlign: 'center', color: Colors.primary, fontWeight: '700', padding: 10 } });
