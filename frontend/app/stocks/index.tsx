// app/stocks/index.tsx
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/design-system';
import { SubScreenHeader } from '@/components/ui/SubScreenHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { formatEggStock, getCurrentUser, listFarms, listFlocks, listStockMovements, validateStockMovement, type StockMovement } from '@/lib/api';

const pad = (n: number) => String(n).padStart(2, '0');
const formatNumber = (v: number) => v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function convertEggs(total: number): string {
  const cartons = Math.floor(total / 360);
  const rem = total % 360;
  const alveoles = Math.floor(rem / 30);
  const eggs = rem % 30;

  const parts: string[] = [];
  if (cartons > 0) parts.push(`${cartons} carton${cartons > 1 ? 's' : ''}`);
  if (alveoles > 0 || cartons > 0) parts.push(`${alveoles} alvéole${alveoles > 1 ? 's' : ''}`);
  if (eggs > 0 || parts.length === 0) parts.push(`${eggs} œuf${eggs > 1 ? 's' : ''}`);

  return parts.join(', ');
}

type StockStatus = 'normal' | 'faible' | 'critique';

interface StockItem {
  id: 'Aliments' | 'Œufs' | 'Cartons' | 'Alvéoles';
  label: string;
  icon: 'grain' | 'egg' | 'inventory-2' | 'apps';
  qty: number;
  unit: string;
  threshold: number;
}

const DEFAULT_THRESHOLDS: Record<StockItem['id'], number> = {
  Aliments: 100,
  'Œufs': 600,
  Cartons: 20,
  Alvéoles: 80,
};

const STATUS_CONFIG: Record<StockStatus, { label: string; bg: string; color: string }> = {
  normal: { label: 'Normal', bg: Colors.tertiaryFixed, color: Colors.onTertiaryFixed },
  faible: { label: 'Faible', bg: Colors.secondaryContainer, color: Colors.onSecondaryContainer },
  critique: { label: 'Critique', bg: Colors.error, color: Colors.onError },
};

const getStatus = (s: StockItem): StockStatus => {
  if (s.qty <= s.threshold) return 'critique';
  if (s.qty <= s.threshold * 1.2) return 'faible';
  return 'normal';
};

export default function StocksScreen() {
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [newThreshold, setNewThreshold] = useState('');
  const [history, setHistory] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isManager, setIsManager] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [validatingMovement, setValidatingMovement] = useState<StockMovement | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState('');

  useEffect(() => {
    getCurrentUser().then((user) => setIsManager(user?.role === 'MANAGER')).catch(() => setIsManager(false));
  }, []);

  useEffect(() => {
    const loadStocks = async () => {
      try {
        const farms = await listFarms();
        if (farms.length === 0) {
          setStocks([]);
          setHistory([]);
          return;
        }

        const farm = farms[0];
        const movements = await listStockMovements(farm.id);
        const balance: Record<string, number> = {};
        for (const movement of movements.filter((item) => item.status === 'validated')) {
          const key = movement.stock_type;
          const delta = movement.movement_type === 'Entrée' ? movement.quantity : -movement.quantity;
          balance[key] = (balance[key] ?? 0) + delta;
        }

        const nextStocks: StockItem[] = [
          { id: 'Aliments', label: 'Aliments', icon: 'grain', qty: Math.max(farm.food_quantity ?? 0, 0), unit: farm.food_unit || 'kg', threshold: DEFAULT_THRESHOLDS.Aliments },
          { id: 'Œufs', label: 'Œufs', icon: 'egg', qty: Math.max(farm.egg_stock ?? 0, 0), unit: formatEggStock(farm.egg_stock ?? 0, farm.cartons, farm.alveoli), threshold: DEFAULT_THRESHOLDS['Œufs'] },
          { id: 'Cartons', label: 'Cartons', icon: 'inventory-2', qty: Math.max(farm.cartons ?? balance.Cartons ?? 0, 0), unit: 'crt', threshold: DEFAULT_THRESHOLDS.Cartons },
          { id: 'Alvéoles', label: 'Alvéoles', icon: 'apps', qty: Math.max(farm.alveoli ?? balance['Alvéoles'] ?? 0, 0), unit: 'alv', threshold: DEFAULT_THRESHOLDS['Alvéoles'] },
        ];

        setStocks(nextStocks);
        setHistory(movements);
      } catch {
        setStocks([]);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    void loadStocks();
  }, []);

  const validateMovement = async (movement: StockMovement) => {
    if (!movement.id) return;
    setValidatingMovement(movement);
    setConfirmationMessage('');
  };

  const submitValidation = async () => {
    if (!validatingMovement || !validatingMovement.id) return;
    const message = confirmationMessage.trim();
    if (!message) {
      Alert.alert('Message requis', 'Écrivez un message avant de confirmer le mouvement.');
      return;
    }
    try {
      await validateStockMovement(validatingMovement.id, message);
      Alert.alert('Succès', 'Mouvement confirmé.');
      await listFlocks(true);
      const farms = await listFarms();
      if (farms[0]) {
        const refreshed = await listStockMovements(farms[0].id);
        setHistory(refreshed);
        const balance: Record<string, number> = {};
        for (const item of refreshed.filter((entry) => entry.status === 'validated')) {
          balance[item.stock_type] = (balance[item.stock_type] ?? 0) + (item.movement_type === 'Entrée' ? item.quantity : -item.quantity);
        }
        setStocks((items) => items.map((item) => ({ ...item, qty: Math.max(balance[item.id] ?? 0, 0) })));
      }
      setValidatingMovement(null);
    } catch (error) {
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Validation impossible.');
    }
  };

  const criticalCount = stocks.filter((s) => getStatus(s) === 'critique').length;

  const saveThreshold = () => {
    const val = parseInt(newThreshold, 10);
    if (isNaN(val) || val < 0 || !editing) return;
    setStocks((p) => p.map((s) => (s.id === editing.id ? { ...s, threshold: val } : s)));
    setEditing(null);
    setNewThreshold('');
  };

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Gestion des Stocks" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Vue d&apos;ensemble de l&apos;inventaire en temps réel</Text>

        {criticalCount > 0 && (
          <View style={styles.criticalBanner}>
            <MaterialIcons name="warning" size={18} color={Colors.onError} />
            <Text style={styles.criticalText}>
              {criticalCount} stock{criticalCount > 1 ? 's' : ''} critique{criticalCount > 1 ? 's' : ''} — réapprovisionnement requis.
            </Text>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingBox}><ActivityIndicator color={Colors.primary} size="small" /><Text style={styles.loadingText}>Chargement des stocks…</Text></View>
        ) : (
          <View style={styles.grid}>
            {stocks.map((s) => {
              const status = getStatus(s);
              const st = STATUS_CONFIG[status];
              return (
                <View key={s.id} style={[styles.card, status === 'critique' && styles.cardDanger]}>
                  <View style={styles.cardTop}>
                    <View style={styles.cardTopLeft}>
                      <View style={[styles.iconBox, status === 'critique' && styles.iconBoxDanger]}>
                        <MaterialIcons name={s.icon} size={18} color={status === 'critique' ? Colors.error : Colors.onSurfaceVariant} />
                      </View>
                      <Text style={styles.cardLabel}>{s.label}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                      <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>

                  <Text style={[styles.cardValue, { color: status === 'critique' ? Colors.error : Colors.primary }]}>
                    {s.id === 'Œufs' ? formatEggStock(s.qty) : `${formatNumber(s.qty)} `}
                    {s.id !== 'Œufs' && <Text style={styles.cardUnit}>{s.unit}</Text>}
                  </Text>

                  {s.id === 'Œufs' && <Text style={styles.conversionText}>= {convertEggs(s.qty)}</Text>}

                  <View style={styles.thresholdRow}>
                    <Text style={styles.cardThreshold}>
                      Seuil d&apos;alerte : {formatNumber(s.threshold)} {s.unit}
                    </Text>
                    <TouchableOpacity onPress={() => { setEditing(s); setNewThreshold(String(s.threshold)); }} hitSlop={8}>
                      <MaterialIcons name="edit" size={15} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {isManager && (
        <View style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Mouvements à confirmer</Text>
          </View>

          {history.filter(m => m.status === 'pending').length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Aucun mouvement en attente.</Text>
            </View>
          ) : (
            history
              .filter(m => m.status === 'pending')
              .slice(0, 3)
              .map((m, i, arr) => (
                <View key={`${m.id ?? i}-${m.movement_date ?? i}`} style={[styles.row, i < arr.length - 1 && styles.rowBorder]}>
                  <View style={styles.rowLeft}>
                    <MaterialIcons name={m.stock_type === 'Aliments' ? 'grain' : m.stock_type === 'Œufs' ? 'egg' : 'inventory-2'} size={16} color={Colors.onSurfaceVariant} />
                    <View>
                      <Text style={styles.rowArticle}>{m.stock_type}</Text>
                      <Text style={styles.rowDate}>{formatDateTime(m.movement_date ?? new Date().toISOString())}</Text>
                    </View>
                  </View>
                  <View style={styles.rowRight}>
                    <View style={styles.typeRow}>
                      <MaterialIcons name={m.movement_type === 'Sortie' ? 'arrow-downward' : 'arrow-upward'} size={14} color={m.movement_type === 'Sortie' ? Colors.error : Colors.primary} />
                      <Text style={[styles.typeText, { color: m.movement_type === 'Sortie' ? Colors.error : Colors.primary }]}>
                        {m.movement_type}
                      </Text>
                    </View>
                    <Text style={styles.qty}>{m.movement_type === 'Sortie' ? '-' : '+'} {formatNumber(m.quantity)} {m.unit}</Text>
                    {isManager && m.status === 'pending' && <TouchableOpacity onPress={() => validateMovement(m)}><Text style={styles.validateText}>Confirmer</Text></TouchableOpacity>}
                  </View>
                </View>
              ))
          )}
        </View>
        )}

        <View style={styles.historyCard}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Historique de validation</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher..."
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholderTextColor={Colors.onSurfaceVariant}
            />
          </View>

          {history
            .filter(m => 
              m.status === 'validated' &&
              (searchTerm === '' || 
                m.stock_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                m.note?.toLowerCase().includes(searchTerm.toLowerCase()))
            )
            .length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Aucun mouvement validé trouvé.</Text>
            </View>
          ) : (
            history
              .filter(m => 
                m.status === 'validated' &&
                (searchTerm === '' || 
                  m.stock_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  m.note?.toLowerCase().includes(searchTerm.toLowerCase()))
              )
              .map((m, i, arr) => (
                <View key={`${m.id ?? i}-${m.movement_date ?? i}`} style={[styles.row, i < arr.length - 1 && styles.rowBorder]}>
                  <View style={styles.rowLeft}>
                    <MaterialIcons name={m.stock_type === 'Aliments' ? 'grain' : m.stock_type === 'Œufs' ? 'egg' : 'inventory-2'} size={16} color={Colors.onSurfaceVariant} />
                    <View>
                      <Text style={styles.rowArticle}>{m.stock_type}</Text>
                      <Text style={styles.rowDate}>{formatDateTime(m.movement_date ?? new Date().toISOString())}</Text>
                      {m.confirmation_message && <Text style={styles.confirmedNote}>Confirmé: {m.confirmation_message}</Text>}
                    </View>
                  </View>
                  <View style={styles.rowRight}>
                    <View style={styles.typeRow}>
                      <MaterialIcons name={m.movement_type === 'Sortie' ? 'arrow-downward' : 'arrow-upward'} size={14} color={m.movement_type === 'Sortie' ? Colors.error : Colors.primary} />
                      <Text style={[styles.typeText, { color: m.movement_type === 'Sortie' ? Colors.error : Colors.primary }]}>
                        {m.movement_type}
                      </Text>
                    </View>
                    <Text style={styles.qty}>{m.movement_type === 'Sortie' ? '-' : '+'} {formatNumber(m.quantity)} {m.unit}</Text>
                    <View style={styles.confirmedBadge}>
                      <MaterialIcons name="check-circle" size={14} color={Colors.primary} />
                      <Text style={styles.confirmedText}>Validé</Text>
                    </View>
                  </View>
                </View>
              ))
          )}
        </View>
      </ScrollView>

      {!isManager && (
        <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => router.push('/stocks/mouvement')}>
          <MaterialIcons name="add" size={26} color={Colors.onPrimaryContainer} />
        </TouchableOpacity>
      )}

      <Modal transparent animationType="slide" visible={!!editing} onRequestClose={() => setEditing(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {editing && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Seuil — {editing.label}</Text>
                  <TouchableOpacity onPress={() => setEditing(null)} hitSlop={10}>
                    <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalLabel}>Nouveau seuil d&apos;alerte ({editing.unit})</Text>
                <View style={styles.inputRow}>
                  <TextInput style={styles.inputRight} keyboardType="number-pad" value={newThreshold} onChangeText={setNewThreshold} />
                  <Text style={styles.inputSuffix}>{editing.unit}</Text>
                </View>
                <PrimaryButton label="Enregistrer le seuil" onPress={saveThreshold} style={{ marginTop: 8 }} />
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="slide" visible={!!validatingMovement} onRequestClose={() => setValidatingMovement(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {validatingMovement && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Confirmer le mouvement</Text>
                  <TouchableOpacity onPress={() => setValidatingMovement(null)} hitSlop={10}>
                    <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalLabel}>{validatingMovement.stock_type} - {validatingMovement.movement_type}</Text>
                <Text style={styles.modalSubtext}>{validatingMovement.movement_type === 'Sortie' ? '-' : '+'} {formatNumber(validatingMovement.quantity)} {validatingMovement.unit}</Text>
                <Text style={styles.modalLabel}>Message obligatoire (ex: heure exacte, conditions)</Text>
                <TextInput
                  style={[styles.textarea, { marginBottom: 12 }]}
                  multiline
                  numberOfLines={3}
                  maxLength={300}
                  placeholder="Écrivez le message de confirmation..."
                  value={confirmationMessage}
                  onChangeText={setConfirmationMessage}
                />
                <PrimaryButton label="Confirmer le mouvement" onPress={submitValidation} />
                <TouchableOpacity onPress={() => setValidatingMovement(null)} style={{ marginTop: 8 }}>
                  <Text style={{ textAlign: 'center', color: Colors.primary, fontWeight: '700', padding: 8 }}>Annuler</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.containerPadding, paddingBottom: 90 },
  subtitle: { color: Colors.onSurfaceVariant, marginBottom: 16 },
  criticalBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.error, borderRadius: Radius.md, padding: 12, marginBottom: 16, ...Shadow.sm },
  criticalText: { flex: 1, color: Colors.onError, fontSize: 13, fontWeight: '700' },
  grid: { gap: Spacing.gridGutter, marginBottom: 24 },
  card: { backgroundColor: Colors.surfaceContainerLowest, borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.md, padding: 16, ...Shadow.card },
  cardDanger: { borderColor: Colors.error, borderWidth: 1.5, backgroundColor: 'rgba(255,218,214,0.15)' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBox: { backgroundColor: Colors.surfaceContainer, padding: 8, borderRadius: Radius.DEFAULT },
  iconBoxDanger: { backgroundColor: Colors.errorContainer },
  cardLabel: { ...Typography.headlineMd, fontSize: 15, color: Colors.onBackground },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.DEFAULT },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardValue: { fontSize: 26, fontWeight: '800', marginBottom: 4 },
  cardUnit: { fontSize: 13, fontWeight: '400', color: Colors.onSurfaceVariant },
  conversionText: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginBottom: 6 },
  thresholdRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardThreshold: { fontSize: 12, color: Colors.onSurfaceVariant },
  historyCard: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.outlineVariant, overflow: 'hidden', ...Shadow.card },
  historyHeader: { padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant, backgroundColor: Colors.surfaceBright },
  historyTitle: { ...Typography.headlineMd, fontSize: 16, color: Colors.onBackground },
  loadingBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  loadingText: { color: Colors.onSurfaceVariant, fontSize: 13, fontWeight: '600' },
  empty: { padding: 20, alignItems: 'center' },
  emptyText: { fontSize: 13, color: Colors.onSurfaceVariant },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.surfaceVariant },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  rowArticle: { fontWeight: '600', fontSize: 13.5, color: Colors.onSurface },
  rowDate: { fontSize: 11.5, color: Colors.onSurfaceVariant, marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  typeText: { fontSize: 12, fontWeight: '600' },
  qty: { fontWeight: '700', fontSize: 13, color: Colors.onSurface, marginTop: 2 },
  pendingText: { color: Colors.warning, fontSize: 11, fontWeight: '700', marginTop: 3 },
  validateText: { color: Colors.primary, fontSize: 12, fontWeight: '800', marginTop: 4 },
  confirmedBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
  confirmedText: { color: Colors.primary, fontSize: 11, fontWeight: '700' },
  confirmedNote: { color: Colors.primary, fontSize: 10, fontWeight: '600', marginTop: 2 },
  searchInput: { borderWidth: 1, borderColor: Colors.outline, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10, fontSize: 13, color: Colors.onSurface },
  textarea: { borderWidth: 1, borderColor: Colors.outline, borderRadius: Radius.md, padding: 12, fontSize: 13, color: Colors.onSurface, textAlignVertical: 'top' },
  modalSubtext: { fontSize: 14, fontWeight: '700', color: Colors.primary, marginBottom: 12 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center', ...Shadow.lg },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.surfaceContainerLowest, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.containerPadding, paddingBottom: 40, gap: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { ...Typography.headlineMd, fontSize: 20, color: Colors.onSurface },
  modalLabel: { ...Typography.labelLg, fontSize: 12, color: Colors.onSurfaceVariant },
  inputRow: { height: Spacing.touchTargetMin, borderWidth: 1.5, borderColor: Colors.outline, borderRadius: Radius.md, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inputRight: { flex: 1, textAlign: 'right', fontSize: 16, color: Colors.onSurface },
  inputSuffix: { marginLeft: 8, color: Colors.onSurfaceVariant, fontWeight: '600', fontSize: 13 },
});