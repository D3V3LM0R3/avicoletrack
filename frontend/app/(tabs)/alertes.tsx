// app/(tabs)/alertes.tsx
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/design-system';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { listNotifications, markNotificationRead, type Notification } from '@/lib/api';

/* ================= TYPES & DONNÉES ================= */

type AlertType = 'mortalite' | 'production' | 'stock' | 'sanitaire';
type Severity = 'critique' | 'attention' | 'info';

interface AlertItem {
  id: number;
  type: AlertType;
  severity: Severity;
  icon: 'warning' | 'trending-down' | 'inventory-2' | 'medical-services' | 'water-drop';
  title: string;
  text: string;
  time: string;
  value?: string;
  threshold?: string;
  recommendation?: string;
}

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string; border: string; icon: 'priority-high' | 'warning' | 'info-outline' }> = {
  critique: { label: 'Critique', color: Colors.error, bg: 'rgba(186,26,26,0.08)', border: Colors.errorContainer, icon: 'priority-high' },
  attention: { label: 'Attention', color: Colors.warning, bg: 'rgba(217,119,6,0.08)', border: Colors.warning, icon: 'warning' },
  info: { label: 'Info', color: Colors.slate, bg: Colors.surfaceContainerHigh, border: Colors.outlineVariant, icon: 'info-outline' },
};

const FILTERS: { key: 'toutes' | AlertType; label: string }[] = [
  { key: 'toutes', label: 'Toutes' },
  { key: 'mortalite', label: 'Mortalité' },
  { key: 'production', label: 'Production' },
  { key: 'stock', label: 'Stock' },
  { key: 'sanitaire', label: 'Sanitaire' },
];

/* ================= COMPOSANT ================= */

export default function AlertesScreen() {
  const { width } = useWindowDimensions();
  const [filter, setFilter] = useState<'toutes' | AlertType>('toutes');
  const [selected, setSelected] = useState<AlertItem | null>(null);
  const [processedIds, setProcessedIds] = useState<number[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    listNotifications()
      .then(setNotifications)
      .catch(() => setNotifications([]))
      .finally(() => setIsLoading(false));
  }, []);

  const liveAlerts: AlertItem[] = notifications.filter((notification) => !notification.read_at).map((notification) => ({
    id: notification.id,
    type: notification.title.toLowerCase().includes('stock') ? 'stock' : notification.title.toLowerCase().includes('mortalité') ? 'mortalite' : 'production',
    severity: 'attention',
    icon: notification.title.toLowerCase().includes('stock') ? 'inventory-2' : 'warning',
    title: notification.title,
    text: notification.message,
    time: new Date(notification.created_at).toLocaleString(),
  }));
  const activeAlerts = liveAlerts.filter((a) => !processedIds.includes(a.id));
  const filtered = activeAlerts.filter((a) => filter === 'toutes' || a.type === filter);

  const markProcessed = (id: number) => {
    setProcessedIds((prev) => [...prev, id]);
    markNotificationRead(id).catch(() => {});
    setSelected(null);
  };

  return (
    <ScreenShell activeTab="alertes">
      <View style={styles.header}>
        <Text style={styles.title}>Alertes</Text>
        <Text style={styles.subtitle}>
          {activeAlerts.length} alerte{activeAlerts.length > 1 ? 's' : ''} active{activeAlerts.length > 1 ? 's' : ''} à traiter
        </Text>
      </View>

      {/* FILTRES PAR TYPE (CDC §5.2) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, { width: Math.min(128, Math.max(88, (width - 56) / 3.5)) }, filter === f.key && styles.chipActive]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.empty}>
            <MaterialIcons name="hourglass-empty" size={48} color={Colors.primary} />
            <Text style={styles.emptyTitle}>Chargement des alertes…</Text>
            <Text style={styles.emptyText}>Récupération des notifications depuis le backend.</Text>
          </View>
        ) : filtered.length === 0 ? (
          /* ---------- ÉTAT VIDE ---------- */
          <View style={styles.empty}>
            <MaterialIcons name="notifications-none" size={48} color={Colors.outline} />
            <Text style={styles.emptyTitle}>Aucune alerte active</Text>
            <Text style={styles.emptyText}>
              Tout va bien pour le moment. Les nouvelles alertes apparaîtront ici.
            </Text>
          </View>
        ) : (
          filtered.map((a) => {
            const sev = SEVERITY_CONFIG[a.severity];
            return (
              <TouchableOpacity
                key={a.id}
                style={[styles.item, { backgroundColor: sev.bg, borderColor: sev.border }]}
                onPress={() => setSelected(a)}
                activeOpacity={0.85}
              >
                <View style={[styles.iconBox, { backgroundColor: sev.bg }]}>
                  <MaterialIcons name={a.icon} size={22} color={sev.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.itemTitleRow}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {a.title}
                    </Text>
                    {/* Badge de gravité : icône + texte (jamais couleur seule) */}
                    <View style={styles.severityBadge}>
                      <MaterialIcons name={sev.icon} size={12} color={sev.color} />
                      <Text style={[styles.severityText, { color: sev.color }]}>{sev.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.itemText}>{a.text}</Text>
                  <View style={styles.itemFooter}>
                    <Text style={styles.itemTime}>{a.time}</Text>
                    <View style={styles.seeDetails}>
                      <Text style={styles.seeDetailsText}>Voir les détails</Text>
                      <MaterialIcons name="chevron-right" size={14} color={Colors.primary} />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* ---------- MODAL DÉTAIL D'ALERTE ---------- */}
      <Modal transparent animationType="slide" visible={!!selected} onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selected && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selected.title}</Text>
                  <TouchableOpacity onPress={() => setSelected(null)} hitSlop={10}>
                    <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalMeta}>
                  <View style={styles.severityBadge}>
                    <MaterialIcons name={SEVERITY_CONFIG[selected.severity].icon} size={12} color={SEVERITY_CONFIG[selected.severity].color} />
                    <Text style={[styles.severityText, { color: SEVERITY_CONFIG[selected.severity].color }]}>
                      {SEVERITY_CONFIG[selected.severity].label}
                    </Text>
                  </View>
                  <Text style={styles.itemTime}>{selected.time}</Text>
                </View>

                <Text style={styles.modalText}>{selected.text}</Text>

                {(selected.value || selected.threshold) && (
                  <View style={styles.valueBox}>
                    {selected.value && (
                      <View style={styles.valueRow}>
                        <Text style={styles.valueLabel}>Valeur concernée</Text>
                        <Text style={styles.valueValue}>{selected.value}</Text>
                      </View>
                    )}
                    {selected.threshold && (
                      <View style={styles.valueRow}>
                        <Text style={styles.valueLabel}>Seuil dépassé</Text>
                        <Text style={[styles.valueValue, { color: Colors.error }]}>{selected.threshold}</Text>
                      </View>
                    )}
                  </View>
                )}

                {selected.recommendation && (
                  <View style={styles.recoBox}>
                    <MaterialIcons name="lightbulb" size={18} color={Colors.warning} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recoTitle}>Recommandation</Text>
                      <Text style={styles.recoText}>{selected.recommendation}</Text>
                    </View>
                  </View>
                )}

                <PrimaryButton
                  label="Voir le rapport lié"
                  icon="assessment"
                  onPress={() => {
                    setSelected(null);
                    router.push('/(tabs)/rapports');
                  }}
                />

                <TouchableOpacity style={styles.processedBtn} onPress={() => markProcessed(selected.id)}>
                  <MaterialIcons name="check-circle" size={16} color={Colors.primary} />
                  <Text style={styles.processedText}>Marquer comme lue</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  header: { padding: Spacing.containerPadding, paddingBottom: 8 },
  title: { ...Typography.headlineLg, fontSize: 24, color: Colors.onBackground },
  subtitle: { ...Typography.bodyMd, fontSize: 14, color: Colors.onSurfaceVariant, marginTop: 4 },
  filterRow: { paddingHorizontal: Spacing.containerPadding, paddingBottom: 12, flexDirection: 'row', gap: 8 },
  chip: { height: 40, paddingHorizontal: 8, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerHigh, borderWidth: 1, borderColor: Colors.outlineVariant, justifyContent: 'center', alignItems: 'center' },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Typography.labelLg, color: Colors.onSurfaceVariant, textAlign: 'center' },
  chipTextActive: { color: Colors.onPrimary },
  scroll: { padding: Spacing.containerPadding, paddingBottom: 40 },
  item: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: Radius.md, borderWidth: 1, marginBottom: 12, ...Shadow.sm },
  iconBox: { width: 44, height: 44, borderRadius: Radius.DEFAULT, alignItems: 'center', justifyContent: 'center' },
  itemTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 },
  itemTitle: { fontWeight: '700', fontSize: 14, color: Colors.onSurface, flex: 1 },
  severityBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  severityText: { ...Typography.labelLg, fontSize: 10 },
  itemText: { fontSize: 13, color: Colors.onSurfaceVariant, lineHeight: 19 },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  itemTime: { fontSize: 11, color: Colors.onSurfaceVariant, fontWeight: '700' },
  seeDetails: { flexDirection: 'row', alignItems: 'center' },
  seeDetailsText: { color: Colors.primary, fontWeight: '700', fontSize: 12 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { ...Typography.headlineMd, fontSize: 18, color: Colors.onSurface },
  emptyText: { ...Typography.bodyMd, fontSize: 14, color: Colors.onSurfaceVariant, textAlign: 'center', maxWidth: 260 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.surfaceContainerLowest, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.containerPadding, paddingBottom: 40, gap: 16, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  modalTitle: { ...Typography.headlineMd, fontSize: 20, color: Colors.onSurface, flex: 1, marginRight: 12 },
  modalMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalText: { ...Typography.bodyMd, fontSize: 14, color: Colors.onSurfaceVariant },
  valueBox: { backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.md, padding: 14, gap: 10 },
  valueRow: { flexDirection: 'row', justifyContent: 'space-between' },
  valueLabel: { ...Typography.bodyMd, fontSize: 13, color: Colors.onSurfaceVariant },
  valueValue: { ...Typography.bodyMd, fontSize: 13, fontWeight: '700', color: Colors.onSurface },
  recoBox: { flexDirection: 'row', gap: 10, backgroundColor: 'rgba(217,119,6,0.08)', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.warning, padding: 14 },
  recoTitle: { ...Typography.labelLg, fontSize: 12, color: Colors.onSurface, marginBottom: 4 },
  recoText: { fontSize: 13, color: Colors.onSurfaceVariant, lineHeight: 19 },
  processedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  processedText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
  lockedBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surfaceContainerHigh, borderRadius: Radius.md, padding: 12 },
  lockedText: { flex: 1, color: Colors.onSurfaceVariant, fontSize: 12, fontWeight: '600' },
});