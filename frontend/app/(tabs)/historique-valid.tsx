import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/design-system';
import { SubScreenHeader } from '@/components/ui/SubScreenHeader';
import { listEvents, listFarms, listFlocks, listStockMovements, type Event, type Farm, type Flock, type StockMovement } from '@/lib/api';

const formatDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
};

const formatQuantity = (value: number, unit?: string) => `${value.toLocaleString('fr-FR')} ${unit ?? ''}`.trim();

export default function HistoriqueValidScreen() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [farmItems, flockItems, eventItems] = await Promise.all([
          listFarms(),
          listFlocks(),
          listEvents(),
        ]);

        setFarms(farmItems);
        setFlocks(flockItems);
        setEvents(eventItems.filter((event) => (event.status === 'confirmed' || event.status === 'cancelled') && new Date(event.event_date).getTime() <= Date.now()));

        if (farmItems.length === 0) {
          setMovements([]);
          return;
        }

        const movementLists = await Promise.all(farmItems.map((farm) => listStockMovements(farm.id)));
        const allMovements = movementLists.flat().filter((item) => item.status === 'validated');
        setMovements(allMovements.sort((a, b) => new Date(b.movement_date ?? b.created_at ?? 0).getTime() - new Date(a.movement_date ?? a.created_at ?? 0).getTime()));
      } catch {
        setFarms([]);
        setFlocks([]);
        setEvents([]);
        setMovements([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Historique validé" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Toutes les opérations validées, confirmées ou annulées.</Text>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Mouvements validés</Text>
          {loading ? (
            <View style={styles.loadingBox}><ActivityIndicator color={Colors.primary} size="small" /><Text style={styles.loadingText}>Chargement…</Text></View>
          ) : movements.length === 0 ? (
            <Text style={styles.empty}>Aucun mouvement validé.</Text>
          ) : movements.map((movement) => {
            const farmName = farms.find((farm) => farm.id === movement.farm_id)?.name ?? 'Ferme';
            const flockName = flocks.find((flock) => flock.id === movement.flock_id)?.breed ?? (movement.flock_id ? `Bande ${movement.flock_id}` : '—');
            return (
              <View key={movement.id} style={styles.row}>
                <View style={styles.iconWrap}>
                  <MaterialIcons name={movement.stock_type === 'Aliments' ? 'grain' : movement.stock_type === 'Œufs' ? 'egg' : 'inventory-2'} size={18} color={Colors.primary} />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.title}>{movement.stock_type}</Text>
                  <Text style={styles.meta}>{farmName} • {flockName}</Text>
                  <Text style={styles.meta}>{movement.movement_type} • {formatQuantity(movement.quantity, movement.unit)}</Text>
                  <Text style={styles.meta}>{formatDateTime(movement.movement_date ?? movement.created_at)}</Text>
                </View>
                <View style={styles.badge}><Text style={styles.badgeText}>Validé</Text></View>
              </View>
            );
          })}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Événements traités</Text>
          {events.length === 0 ? (
            <Text style={styles.empty}>Aucun événement confirmé.</Text>
          ) : events.map((event) => {
            const farmName = farms.find((farm) => farm.id === event.farm_id)?.name ?? 'Ferme';
            return (
              <View key={event.id} style={styles.row}>
                <View style={styles.iconWrap}>
                  <MaterialIcons name="event" size={18} color={Colors.primary} />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.title}>{event.title}</Text>
                  <Text style={styles.meta}>{farmName}</Text>
                  <Text style={styles.meta}>{event.type}</Text>
                  <Text style={styles.meta}>{formatDateTime(event.event_date)}</Text>
                </View>
                <View style={[styles.badge, event.status === 'cancelled' && styles.cancelledBadge]}><Text style={styles.badgeText}>{event.status === 'cancelled' ? 'Annulé' : 'OK'}</Text></View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.containerPadding, paddingBottom: 100, gap: 16 },
  subtitle: { color: Colors.onSurfaceVariant, fontSize: 13 },
  sectionCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: 14,
    gap: 10,
    ...Shadow.card,
  },
  sectionTitle: {
    ...Typography.headlineMd,
    fontSize: 17,
    color: Colors.onSurface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceVariant,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: Colors.onSurface },
  meta: { fontSize: 11.5, color: Colors.onSurfaceVariant, marginTop: 2 },
  badge: {
    backgroundColor: 'rgba(13,99,27,0.12)',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cancelledBadge: { backgroundColor: Colors.errorContainer },
  badgeText: { color: Colors.primary, fontSize: 10, fontWeight: '800' },
  empty: { fontSize: 12.5, color: Colors.onSurfaceVariant },
  loadingBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  loadingText: { color: Colors.onSurfaceVariant, fontSize: 12.5, fontWeight: '600' },
});
