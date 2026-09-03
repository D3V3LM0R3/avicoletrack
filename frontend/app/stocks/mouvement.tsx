// app/stocks/mouvement.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import NetInfo from '@react-native-community/netinfo';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Radius, Spacing, Typography } from '@/constants/design-system';
import { SubScreenHeader } from '@/components/ui/SubScreenHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { createStockMovement, getCurrentUser, listFarms, listFlocks, listMarketPrices, listStockMovements, type Farm, type Flock, type MarketPrice } from '@/lib/api';
import { enqueueOfflineItem } from '@/lib/offline-sync';

const STOCK_TYPES = ['Aliments', 'Œufs', 'Cartons', 'Alvéoles', 'Sujets', 'Autre'] as const;
type StockType = (typeof STOCK_TYPES)[number];

const UNIT_PER_TYPE: Record<StockType, string> = {
  Aliments: 'kg',
  Œufs: 'unités',
  Cartons: 'unités',
  Alvéoles: 'unités',
  Sujets: 'têtes',
  Autre: 'unités',
};

const pad = (n: number) => String(n).padStart(2, '0');
const formatFr = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const formatNumber = (v: number) => v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export default function MouvementStockScreen() {
  const [type, setType] = useState<'Entrée' | 'Sortie'>('Entrée');
  const [stockType, setStockType] = useState<StockType | null>(null);
  const [qty, setQty] = useState('');
  const [motif, setMotif] = useState('');
  const [productName, setProductName] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [priceTier, setPriceTier] = useState<'low' | 'mid' | 'high'>('mid');
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmId, setFarmId] = useState<number | null>(null);
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [flockId, setFlockId] = useState<number | null>(null);
  const [currentBalance, setCurrentBalance] = useState<Record<string, number>>({});
  const [isOwner, setIsOwner] = useState(false);
  const [toast, setToast] = useState('');

  const loadBalanceForFarm = useCallback(async (selectedFarmId: number, selectedFarm?: Farm) => {
    try {
      const movements = await listStockMovements(selectedFarmId);
      const farm = selectedFarm ?? farms.find((item) => item.id === selectedFarmId);
      const balances: Record<string, number> = {
        Aliments: Math.max(farm?.food_quantity ?? 0, 0),
        Œufs: Math.max(farm?.egg_stock ?? 0, 0),
        Cartons: Math.max(farm?.cartons ?? 0, 0),
        Alvéoles: Math.max(farm?.alveoli ?? 0, 0),
      };
      for (const item of movements.filter((movement) => movement.status === 'validated')) {
        if (['Aliments', 'Œufs', 'Cartons', 'Alvéoles'].includes(item.stock_type)) continue;
        const key = item.stock_type;
        const delta = item.movement_type === 'Entrée' ? item.quantity : -item.quantity;
        balances[key] = (balances[key] ?? 0) + delta;
      }
      setCurrentBalance(balances);
    } catch {
      setCurrentBalance({});
    }
  }, [farms]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 2800);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    getCurrentUser().then((user) => setIsOwner(user?.role === 'OWNER')).catch(() => setIsOwner(false));
  }, []);

  useEffect(() => { listMarketPrices().then(setMarketPrices).catch(() => setMarketPrices([])); }, []);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => setIsOnline(s.isConnected ?? true));
    return unsub;
  }, []);

  useEffect(() => {
    const loadDefaultFarm = async () => {
      try {
        const [farmItems, flockItems] = await Promise.all([listFarms(), listFlocks()]);
        setFarms(farmItems);
        setFlocks(flockItems);
        if (farmItems.length === 0) {
          setFarmId(null);
          return;
        }
        const selectedFarmId = farmItems[0].id;
        setFarmId(selectedFarmId);
        await loadBalanceForFarm(selectedFarmId, farmItems.find((farm) => farm.id === selectedFarmId));
      } catch {
        setFarmId(null);
      }
    };

    void loadDefaultFarm();
  }, [loadBalanceForFarm]);

  const qtyNum = parseFloat(qty.replace(',', '.')) || 0;
  const unit = stockType ? UNIT_PER_TYPE[stockType] : '';
  const selectedFlock = flockId ? flocks.find((flock) => flock.id === flockId) : null;
  const totalFarmSubjects = flocks.filter((flock) => flock.farm_id === farmId && !flock.archived).reduce((total, flock) => total + flock.bird_count, 0);
  const availableQty = stockType === 'Sujets'
    ? (selectedFlock?.bird_count ?? totalFarmSubjects)
    : stockType ? (currentBalance[stockType] ?? 0) : 0;
  const priceKey = stockType === 'Œufs' ? 'egg' : stockType === 'Aliments' ? 'feed' : stockType === 'Cartons' ? 'carton' : stockType === 'Alvéoles' ? 'alveole' : stockType === 'Sujets' ? 'chicken' : 'others';
  const selectedMarketPrice = marketPrices.find((item) => item.product_key === priceKey || item.product_key === productName.trim().toLowerCase().replace(/\s+/g, '_'));
  const selectedTierPrice = selectedMarketPrice?.[`price_${priceTier}`] ?? selectedMarketPrice?.price;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!stockType) e.stockType = 'Le type de stock est obligatoire.';
    if (stockType === 'Autre' && !productName.trim()) e.productName = 'Indiquez le nom du produit.';
    if (!qty.trim() || Number.isNaN(qtyNum) || qtyNum <= 0) e.qty = 'La quantité doit être supérieure à zéro.';
    else if (type === 'Sortie' && stockType && qtyNum > availableQty) {
      e.qty = `La sortie ne peut pas dépasser le stock disponible (${formatNumber(availableQty)} ${unit}).`;
    }
    if (!farmId) e.farm = 'Une ferme doit être sélectionnée.';
    if (stockType === 'Sujets' && !flockId) e.flock = 'Une bande doit être sélectionnée pour les mouvements de sujets.';
    if (date.getTime() > Date.now()) e.date = 'La date ne peut pas être dans le futur.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !stockType || farmId === null || qtyNum <= 0) {
      if (!farmId) Alert.alert('Ferme manquante', 'Aucune ferme accessible n’a été trouvée.');
      if (qtyNum <= 0) Alert.alert('Données invalides', 'La quantité doit être supérieure à zéro.');
      if (stockType === 'Sujets' && !flockId) Alert.alert('Bande requise', 'Un mouvement de sujets doit être associé à une bande.');
      if (stockType === 'Autre' && !productName.trim()) Alert.alert('Produit requis', 'Indiquez le nom du produit.');
      return;
    }

    setSaving(true);
    try {
      if (!isOnline) {
        await enqueueOfflineItem({
          type: 'stock_movement',
          createdAt: Date.now(),
          farm_id: farmId,
          flock_id: flockId,
          movement: type,
          stockType,
          qty: qtyNum,
          unit,
          motif,
          date: formatFr(date),
        });
        Alert.alert('Mode hors-ligne', 'Mouvement enregistré localement. Il sera synchronisé au retour du réseau.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }

      await createStockMovement({
        farm_id: farmId,
        flock_id: flockId,
        stock_type: stockType,
        movement_type: type,
        quantity: qtyNum,
        unit,
        note: motif || null,
        product_name: productName.trim() || stockType,
        unit_price: unitPrice ? parseFloat(unitPrice.replace(',', '.')) : undefined,
        movement_date: date.toISOString(),
      });

      setToast(`${type} de ${formatNumber(qtyNum)} ${unit} (${stockType}) enregistrée.`);
      setTimeout(() => router.back(), 1000);
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer le mouvement. Veuillez réessayer.");
    } finally {
      setSaving(false);
    }
  };

  const onDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (!selected) { setShowPicker(false); return; }
    const next = new Date(date);
    if (pickerMode === 'date') { next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate()); setPickerMode('time'); }
    else { next.setHours(selected.getHours(), selected.getMinutes(), 0, 0); setShowPicker(false); }
    setDate(next);
    if (errors.date) setErrors({ ...errors, date: '' });
  };

  const handleFarmChange = async (selectedFarmId: number) => {
    setFarmId(selectedFarmId);
    setFlockId(null);
    await loadBalanceForFarm(selectedFarmId, farms.find((farm) => farm.id === selectedFarmId));
  };

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Mouvement de Stock" onBack={() => router.back()} />
      {toast !== '' && (
        <View style={styles.toast}>
          <MaterialIcons name="check-circle" size={16} color={Colors.primary} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerBlock}>
          <Text style={styles.title}>Saisie Mouvement de Stock</Text>
          <Text style={styles.subtitle}>Enregistrez une entrée ou une sortie pour mettre à jour l&apos;inventaire.</Text>
        </View>

        <Text style={styles.label}>Ferme concernée</Text>
        <View style={styles.farmRow}>
          {farms.map((farm) => (
            <TouchableOpacity
              key={farm.id}
              activeOpacity={0.8}
              onPress={() => handleFarmChange(farm.id)}
              style={[styles.farmChip, farmId === farm.id && styles.farmChipActive]}
            >
              <Text style={[styles.farmChipText, farmId === farm.id && styles.farmChipTextActive]}>{farm.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {flocks.filter((flock) => flock.farm_id === farmId && !flock.archived).length > 0 && <>
          <Text style={styles.label}>Bande concernée</Text>
          <View style={styles.farmRow}>{flocks.filter((flock) => flock.farm_id === farmId && !flock.archived).map((flock) => <TouchableOpacity key={flock.id} onPress={() => setFlockId(flockId === flock.id ? null : flock.id)} style={[styles.farmChip, flockId === flock.id && styles.farmChipActive]}><Text style={[styles.farmChipText, flockId === flock.id && styles.farmChipTextActive]}>{flock.breed || `Bande ${flock.id}`} • {flock.bird_count} sujets</Text></TouchableOpacity>)}</View>
        </>}
          {errors.flock !== '' && errors.flock !== undefined && <Text style={styles.errorText}>{errors.flock}</Text>}

        <Text style={styles.label}>Type de mouvement</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity style={[styles.toggleBtn, type === 'Entrée' && styles.toggleBtnActiveIn]} onPress={() => setType('Entrée')} activeOpacity={0.8}>
            <MaterialIcons name="arrow-upward" size={18} color={type === 'Entrée' ? Colors.onPrimary : Colors.primary} />
            <Text style={[styles.toggleText, type === 'Entrée' && { color: Colors.onPrimary }]}>Entrée</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toggleBtn, type === 'Sortie' && styles.toggleBtnActiveOut]} onPress={() => setType('Sortie')} activeOpacity={0.8}>
            <MaterialIcons name="arrow-downward" size={18} color={type === 'Sortie' ? Colors.onError : Colors.error} />
            <Text style={[styles.toggleText, type === 'Sortie' && { color: Colors.onError }]}>Sortie</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Type de stock</Text>
        <View style={styles.chipRow}>
          {STOCK_TYPES.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.chip, stockType === t && styles.chipActive]}
              onPress={() => { setStockType(t); setProductName(t === 'Autre' ? '' : t); setUnitPrice(''); if (errors.stockType) setErrors({ ...errors, stockType: '' }); if (errors.qty) setErrors({ ...errors, qty: '' }); }}
            >
              <Text style={[styles.chipText, stockType === t && styles.chipTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.stockType !== '' && errors.stockType !== undefined && <Text style={styles.errorText}>{errors.stockType}</Text>}

        {stockType && (
          <View style={styles.infoRow}>
            <MaterialIcons name="inventory-2" size={16} color={Colors.onSurfaceVariant} />
            <Text style={styles.infoText}>
              Stock actuel : {formatNumber(availableQty)} {UNIT_PER_TYPE[stockType]}
            </Text>
          </View>
        )}

        <Text style={styles.label}>Quantité</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.inputRight}
            keyboardType="decimal-pad"
            placeholder="0"
            value={qty}
            onChangeText={(t) => { setQty(t); if (errors.qty) setErrors({ ...errors, qty: '' }); }}
          />
          <Text style={styles.inputSuffix}>{unit || '—'}</Text>
        </View>
        {errors.qty !== '' && errors.qty !== undefined && <Text style={styles.errorText}>{errors.qty}</Text>}

        <Text style={styles.label}>Date et heure du mouvement</Text>
        <TouchableOpacity style={styles.dateBox} onPress={() => { setPickerMode('date'); setShowPicker(true); }} activeOpacity={0.8}>
          <MaterialIcons name="calendar-month" size={16} color={Colors.onSurfaceVariant} />
          <Text style={styles.dateText}>{new Date(date).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</Text>
          <MaterialIcons name="edit" size={14} color={Colors.primary} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>
        {errors.date !== '' && errors.date !== undefined && <Text style={styles.errorText}>{errors.date}</Text>}
        {showPicker && (
          <View style={{ marginTop: 8 }}>
            <DateTimePicker value={date} mode={pickerMode} display={Platform.OS === 'ios' ? 'spinner' : 'default'} maximumDate={new Date()} onChange={onDateChange} />
            {Platform.OS === 'ios' && (
              <TouchableOpacity onPress={() => setShowPicker(false)} style={styles.pickerClose}>
                <Text style={styles.pickerCloseText}>Fermer</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <Text style={styles.label}>Motif / Observations</Text>
        <TextInput
          style={styles.textarea}
          multiline
          numberOfLines={3}
          maxLength={300}
          placeholder="Ex : Livraison fournisseur, consommation quotidienne..."
          value={motif}
          onChangeText={setMotif}
        />
        <Text style={styles.label}>Nom personnalisé du produit (optionnel)</Text>
        <TextInput style={styles.input} placeholder="Ex : Poulet Ross 308" value={productName} onChangeText={setProductName} />
        {errors.productName && <Text style={styles.errorText}>{errors.productName}</Text>}
        {selectedMarketPrice && <><Text style={styles.label}>Prix du marché</Text><View style={styles.priceTierRow}>{(['low', 'mid', 'high'] as const).map((tier) => <TouchableOpacity key={tier} style={[styles.priceTier, priceTier === tier && styles.priceTierActive]} onPress={() => { setPriceTier(tier); setUnitPrice(String(selectedMarketPrice[`price_${tier}`] ?? selectedMarketPrice.price)); }}><Text style={priceTier === tier ? styles.priceTierTextActive : styles.priceTierText}>{tier === 'low' ? 'Bas' : tier === 'mid' ? 'Moyen' : 'Haut'}: {selectedMarketPrice[`price_${tier}`] ?? selectedMarketPrice.price} FCFA</Text></TouchableOpacity>)}</View></>}
        <Text style={styles.label}>Prix unitaire (optionnel)</Text>
        <TextInput style={styles.input} placeholder={selectedTierPrice ? `Prix sélectionné: ${selectedTierPrice} FCFA` : 'Ex : 2500 FCFA'} keyboardType="decimal-pad" value={unitPrice} onChangeText={setUnitPrice} />
      </ScrollView>

      <View style={styles.actionBar}>
        <PrimaryButton
          label={saving ? 'Enregistrement...' : isOnline ? 'Enregistrer' : 'Enregistrer localement'}
          icon={saving ? undefined : 'save'}
          onPress={handleSave}
          disabled={saving || !isOwner}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  toast: { position: 'absolute', top: 12, left: 16, right: 16, zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(13,99,27,0.12)', borderRadius: Radius.DEFAULT, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(13,99,27,0.2)' },
  toastText: { color: Colors.primary, fontSize: 12.5, fontWeight: '700', flexShrink: 1 },
  scroll: { padding: Spacing.containerPadding, paddingBottom: 110 },
  headerBlock: { marginBottom: 20 },
  title: { ...Typography.headlineMd, fontSize: 18, color: Colors.onSurface },
  subtitle: { fontSize: 13, color: Colors.onSurfaceVariant, marginTop: 4 },
  label: { ...Typography.labelLg, fontSize: 12, color: Colors.onSurfaceVariant, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.md, padding: 12, color: Colors.onSurface, backgroundColor: Colors.surfaceContainerLowest, marginBottom: 10 },
  farmRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.stackGap },
  farmChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerHigh, borderWidth: 1, borderColor: Colors.outlineVariant },
  farmChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  farmChipText: { color: Colors.onSurfaceVariant, fontWeight: '600' },
  farmChipTextActive: { color: Colors.onPrimary },
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.stackGap },
  toggleBtn: { flex: 1, height: 48, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  toggleBtnActiveIn: { backgroundColor: Colors.primary },
  toggleBtnActiveOut: { backgroundColor: Colors.error, borderColor: Colors.error },
  toggleText: { fontWeight: '700', fontSize: 14, color: Colors.primary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.stackGap },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerHigh, borderWidth: 1, borderColor: Colors.outlineVariant },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Typography.labelLg, color: Colors.onSurfaceVariant },
  chipTextActive: { color: Colors.onPrimary },
  errorText: { color: Colors.error, fontSize: 12, marginTop: -4, marginBottom: 8, marginLeft: 4 },
  priceTierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  priceTier: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.outlineVariant, backgroundColor: Colors.surfaceContainerHigh },
  priceTierActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  priceTierText: { color: Colors.onSurfaceVariant, fontSize: 11, fontWeight: '700' },
  priceTierTextActive: { color: Colors.onPrimary, fontSize: 11, fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.DEFAULT, paddingHorizontal: 12, paddingVertical: 10, marginBottom: Spacing.stackGap },
  infoText: { fontSize: 13, color: Colors.onSurfaceVariant },
  inputRow: { height: Spacing.touchTargetMin, borderWidth: 1, borderColor: Colors.outline, borderRadius: Radius.md, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.stackGap },
  inputRight: { flex: 1, textAlign: 'right', fontSize: 16, color: Colors.onSurface },
  inputSuffix: { marginLeft: 8, color: Colors.onSurfaceVariant, fontWeight: '600', fontSize: 13 },
  dateBox: { height: Spacing.touchTargetMin, borderWidth: 1, borderColor: Colors.outline, borderRadius: Radius.md, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.stackGap },
  dateText: { color: Colors.onSurface, fontSize: 14, fontWeight: '600' },
  pickerClose: { alignItems: 'center', paddingVertical: 8 },
  pickerCloseText: { color: Colors.primary, fontWeight: '700' },
  textarea: { borderWidth: 1, borderColor: Colors.outline, borderRadius: Radius.md, padding: 14, minHeight: 90, textAlignVertical: 'top', color: Colors.onSurface, fontSize: 14 },
  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surfaceContainerLowest, borderTopWidth: 1, borderTopColor: Colors.outlineVariant, padding: Spacing.containerPadding },
});