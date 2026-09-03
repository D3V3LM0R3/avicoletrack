import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/design-system';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { cancelStockMovement, deleteStockMovement, getCurrentUser, listFarms, listFlocks, listStockMovements, validateStockMovement, type Farm, type Flock, type StockMovement } from '@/lib/api';

const formatDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
};

const formatQuantity = (value: number, unit?: string) => `${value.toLocaleString('fr-FR')} ${unit ?? ''}`.trim();

export default function MouvementsScreen() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);
  const [toast, setToast] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    const load = async () => {
      try {
        const [currentUser, farmItems, flockItems] = await Promise.all([
          getCurrentUser(),
          listFarms(),
          listFlocks(),
        ]);

        setRole(currentUser?.role ?? null);
        setFarms(farmItems);
        setFlocks(flockItems);

        if (farmItems.length === 0) {
          setMovements([]);
          return;
        }

        const movementLists = await Promise.all(farmItems.map((farm) => listStockMovements(farm.id)));
        const allMovements = movementLists.flat();
        setMovements(allMovements.sort((a, b) => new Date(b.movement_date ?? b.created_at ?? 0).getTime() - new Date(a.movement_date ?? a.created_at ?? 0).getTime()));
      } catch {
        setFarms([]);
        setFlocks([]);
        setMovements([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const query = search.trim().toLowerCase();
  const matchesMovement = useCallback((movement: StockMovement) => {
    if (!query) return true;
    const farmName = farms.find((farm) => farm.id === movement.farm_id)?.name ?? '';
    const flock = flocks.find((item) => item.id === movement.flock_id);
    return [
      movement.stock_type,
      movement.movement_type,
      movement.status,
      movement.unit,
      movement.note,
      movement.confirmation_message,
      farmName,
      flock?.name,
      flock?.breed,
      movement.quantity,
    ].filter(Boolean).join(' ').toLowerCase().includes(query);
  }, [farms, flocks, query]);
  const pendingMovements = useMemo(() => movements.filter((item) => item.status === 'pending' && matchesMovement(item)), [movements, matchesMovement]);
  const confirmedMovements = useMemo(() => movements.filter((item) => (item.status === 'validated' || item.status === 'cancelled') && matchesMovement(item)), [movements, matchesMovement]);
  const canManageMovements = role === 'MANAGER' || role === 'OWNER';

  const applyMovementAction = async (movement: StockMovement, action: 'confirm' | 'cancel') => {
    if (!movement.id) return;
    const message = actionReason.trim();
    if (!message) {
      Alert.alert('Message requis', `Écrivez un message avant de ${action === 'confirm' ? 'confirmer' : 'annuler'} le mouvement.`);
      return;
    }
    try {
      if (action === 'confirm') {
        await validateStockMovement(movement.id, message);
        setMovements((current) => current.map((item) => (item.id === movement.id ? { ...item, status: 'validated', confirmation_message: message } : item)));
        setToast('Mouvement confirmé.');
      } else {
        await cancelStockMovement(movement.id, message);
        setMovements((current) => current.map((item) => (item.id === movement.id ? { ...item, status: 'cancelled', confirmation_message: message } : item)));
        setToast('Mouvement annulé.');
      }
    } catch (error) {
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Action impossible.');
    } finally {
      setActionReason('');
      setSelectedMovement(null);
    }
  };

  const deletePendingMovement = (movement: StockMovement) => {
    if (!movement.id) return;
    Alert.alert('Supprimer le mouvement ?', 'Ce mouvement en attente sera supprimé définitivement.', [
      { text: 'Revenir', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try {
          await deleteStockMovement(movement.id!);
          setMovements((current) => current.filter((item) => item.id !== movement.id));
          setSelectedMovement(null);
          setToast('Mouvement supprimé.');
        } catch (error) {
          Alert.alert('Erreur', error instanceof Error ? error.message : 'Suppression impossible.');
        }
      } },
    ]);
  };

  return (
    <ScreenShell activeTab="mouvements">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Mouvements</Text>
          <Text style={styles.subtitle}>Suivi des mouvements de stock de la ferme.</Text>
        </View>

        <View style={styles.searchBox}>
          <MaterialIcons name="search" size={20} color={Colors.outline} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un mouvement..."
            placeholderTextColor={Colors.outline}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8} accessibilityLabel="Effacer la recherche">
              <MaterialIcons name="close" size={18} color={Colors.onSurfaceVariant} />
            </TouchableOpacity>
          )}
        </View>

        {canManageMovements && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>À confirmer</Text>
              <View style={styles.badge}><Text style={styles.badgeText}>{pendingMovements.length}</Text></View>
            </View>

            {loading ? (
              <View style={styles.loadingBox}><ActivityIndicator color={Colors.primary} size="small" /><Text style={styles.loadingText}>Chargement…</Text></View>
            ) : pendingMovements.length === 0 ? (
              <Text style={styles.empty}>Aucun mouvement en attente de confirmation.</Text>
            ) : (
              pendingMovements.map((movement) => {
                const farmName = farms.find((farm) => farm.id === movement.farm_id)?.name ?? 'Ferme';
                const flockName = flocks.find((flock) => flock.id === movement.flock_id)?.name ?? flocks.find((flock) => flock.id === movement.flock_id)?.breed ?? (movement.flock_id ? `Bande ${movement.flock_id}` : '—');

                return (
                  <View key={movement.id ?? `${movement.farm_id}-${movement.movement_date}`} style={styles.rowCard}>
                    <View style={styles.rowTop}>
                      <View style={styles.iconWrap}>
                        <MaterialIcons name={movement.stock_type === 'Aliments' ? 'grain' : movement.stock_type === 'Œufs' ? 'egg' : 'inventory-2'} size={18} color={Colors.primary} />
                      </View>
                      <View style={styles.rowMeta}>
                        <Text style={styles.itemTitle}>{movement.stock_type}</Text>
                        <Text style={styles.itemMeta}>{farmName} • {flockName}</Text>
                      </View>
                      <View style={[styles.statusPill, styles.pendingPill]}>
                        <Text style={styles.statusText}>En attente</Text>
                      </View>
                    </View>

                    <Text style={styles.amount}>{movement.movement_type === 'Sortie' ? '-' : '+'} {formatQuantity(movement.quantity, movement.unit)}</Text>
                    <Text style={styles.detailText}>Date / heure: {formatDateTime(movement.movement_date ?? movement.created_at)}</Text>
                    <Text style={styles.detailText}>Détails: {movement.note || movement.confirmation_message || 'Aucune observation pour ce mouvement.'}</Text>

                    <View style={styles.manageRow}>
                      <TouchableOpacity style={styles.confirmButton} onPress={() => setSelectedMovement(movement)}>
                        <MaterialIcons name="check-circle" size={16} color={Colors.onPrimary} />
                        <Text style={styles.confirmButtonText}>Confirmer</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.cancelButton} onPress={() => setSelectedMovement(movement)}>
                        <MaterialIcons name="close" size={16} color={Colors.error} />
                        <Text style={styles.cancelButtonText}>Annuler</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mouvements confirmés</Text>
            <View style={styles.badge}><Text style={styles.badgeText}>{confirmedMovements.length}</Text></View>
          </View>

          {loading ? (
            <View style={styles.loadingBox}><ActivityIndicator color={Colors.primary} size="small" /><Text style={styles.loadingText}>Chargement…</Text></View>
          ) : confirmedMovements.length === 0 ? (
            <Text style={styles.empty}>Aucun mouvement confirmé pour le moment.</Text>
          ) : confirmedMovements.slice(0, 8).map((movement) => {
            const farmName = farms.find((farm) => farm.id === movement.farm_id)?.name ?? 'Ferme';
            return (
              <TouchableOpacity key={movement.id} style={styles.historyRow} activeOpacity={0.8} onPress={() => setSelectedMovement(movement)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{movement.stock_type}</Text>
                  <Text style={styles.itemMeta}>{farmName}</Text>
                </View>
                <View style={styles.historyRight}>
                  <Text style={styles.amountSmall}>{movement.movement_type === 'Sortie' ? '-' : '+'}{formatQuantity(movement.quantity, movement.unit)}</Text>
                  <Text style={[styles.stateText, movement.status === 'cancelled' && { color: Colors.error }]}>{movement.status === 'cancelled' ? 'Annulé' : 'Confirmé'}</Text>
                  {movement.confirmation_message && <Text style={styles.detailText}>{movement.confirmation_message}</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {toast !== '' && (
        <View style={styles.toast}>
          <MaterialIcons name="check-circle" size={18} color={Colors.primary} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      <Modal transparent animationType="fade" visible={!!selectedMovement} onRequestClose={() => setSelectedMovement(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selectedMovement && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedMovement.stock_type}</Text>
                  <TouchableOpacity onPress={() => setSelectedMovement(null)} hitSlop={10}>
                    <MaterialIcons name="close" size={20} color={Colors.onSurfaceVariant} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalMeta}>Date / heure: {formatDateTime(selectedMovement.movement_date ?? selectedMovement.created_at)}</Text>
                <Text style={styles.modalAmount}>{selectedMovement.movement_type === 'Sortie' ? '-' : '+'}{formatQuantity(selectedMovement.quantity, selectedMovement.unit)}</Text>
                <Text style={styles.modalText}>Ferme: {farms.find((farm) => farm.id === selectedMovement.farm_id)?.name ?? '—'}</Text>
                <Text style={styles.modalText}>Bande: {selectedMovement.flock_id ? flocks.find((flock) => flock.id === selectedMovement.flock_id)?.name ?? `#${selectedMovement.flock_id}` : '—'}</Text>
                <Text style={styles.modalText}>Type: {selectedMovement.stock_type}</Text>
                <Text style={styles.modalText}>Statut: {selectedMovement.status === 'validated' ? 'Confirmé' : selectedMovement.status === 'pending' ? 'En attente' : 'Annulé'}</Text>
                <Text style={styles.modalText}>Détails du mouvement: {selectedMovement.note || selectedMovement.confirmation_message || 'Aucune observation.'}</Text>

                {canManageMovements && selectedMovement.status === 'pending' && (
                  <>
                    <TextInput
                      value={actionReason}
                      onChangeText={setActionReason}
                      placeholder="Motif ou observation"
                      multiline
                      style={styles.input}
                    />
                    <View style={styles.manageRow}>
                      <TouchableOpacity style={styles.confirmButton} onPress={() => void applyMovementAction(selectedMovement, 'confirm')}>
                        <Text style={styles.confirmButtonText}>Confirmer</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.cancelButton} onPress={() => void applyMovementAction(selectedMovement, 'cancel')}>
                        <Text style={styles.cancelButtonText}>Annuler</Text>
                      </TouchableOpacity>
                      {role === 'OWNER' && <TouchableOpacity style={styles.cancelButton} onPress={() => deletePendingMovement(selectedMovement)}>
                        <Text style={styles.cancelButtonText}>Supprimer</Text>
                      </TouchableOpacity>}
                    </View>
                  </>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.containerPadding, paddingBottom: 110, gap: 16 },
  header: { gap: 4 },
  title: { ...Typography.headlineLg, fontSize: 26, color: Colors.onBackground },
  subtitle: { color: Colors.onSurfaceVariant, fontSize: 13 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.md, paddingHorizontal: 12, backgroundColor: Colors.surfaceContainerLowest },
  searchInput: { flex: 1, color: Colors.onSurface, fontSize: 14 },
  sectionCard: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.outlineVariant, padding: 14, gap: 12, ...Shadow.card },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { ...Typography.headlineMd, fontSize: 17, color: Colors.onSurface },
  badge: { minWidth: 28, height: 28, paddingHorizontal: 8, borderRadius: Radius.full, backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: Colors.onPrimaryContainer, fontSize: 12, fontWeight: '700' },
  rowCard: { backgroundColor: Colors.surfaceContainerHigh, borderRadius: Radius.md, padding: 12, gap: 8 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  rowMeta: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: '700', color: Colors.onSurface },
  itemMeta: { fontSize: 11.5, color: Colors.onSurfaceVariant, marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: Radius.full },
  pendingPill: { backgroundColor: 'rgba(217,119,6,0.12)' },
  statusText: { color: Colors.warning, fontSize: 10, fontWeight: '800' },
  amount: { fontSize: 16, fontWeight: '800', color: Colors.onSurface },
  amountSmall: { fontSize: 13, fontWeight: '700', color: Colors.onSurface },
  detailText: { fontSize: 12, color: Colors.onSurfaceVariant },
  confirmButton: { marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, paddingVertical: 10, borderRadius: Radius.md },
  confirmButtonText: { color: Colors.onPrimary, fontSize: 12, fontWeight: '800' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.surfaceVariant },
  historyRight: { alignItems: 'flex-end' },
  stateText: { fontSize: 11, color: Colors.primary, fontWeight: '700', marginTop: 2 },
  loadingBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  loadingText: { color: Colors.onSurfaceVariant, fontSize: 13, fontWeight: '600' },
  empty: { fontSize: 12.5, color: Colors.onSurfaceVariant },
  manageRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  cancelButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.08)', paddingVertical: 10, borderRadius: Radius.md },
  cancelButtonText: { color: Colors.error, fontWeight: '800' },
  toast: { position: 'absolute', top: 18, left: 16, right: 16, zIndex: 50, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(13,99,27,0.12)', borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(13,99,27,0.2)' },
  toastText: { color: Colors.primary, fontSize: 12.5, fontWeight: '700', flexShrink: 1 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalCard: { width: '92%', backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.lg, padding: 18, gap: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { ...Typography.headlineMd, color: Colors.onSurface, fontSize: 20 },
  modalMeta: { color: Colors.onSurfaceVariant, fontSize: 12 },
  modalAmount: { color: Colors.primary, fontSize: 26, fontWeight: '800' },
  modalText: { color: Colors.onSurface, fontSize: 13 },
  input: { minHeight: 90, borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.md, padding: 12, textAlignVertical: 'top', backgroundColor: Colors.surfaceContainerHigh, color: Colors.onSurface },
});
