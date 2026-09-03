// app/prix/index.tsx
import React, { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/design-system';
import { SubScreenHeader } from '@/components/ui/SubScreenHeader';
import { FormField } from '@/components/ui/FormField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { createMarketPrice, listMarketPrices, refreshMarketPrices, updateMarketPrice, type MarketPrice } from '@/lib/api';

const fmtInt = (v: number) => v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export default function PrixScreen() {
  const [region, setRegion] = useState('Toutes');
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingPrice, setEditingPrice] = useState<MarketPrice | null>(null);
  const [product, setProduct] = useState('');
  const [productKey, setProductKey] = useState('others');
  const [price, setPrice] = useState('');
  const [priceLow, setPriceLow] = useState('');
  const [priceMid, setPriceMid] = useState('');
  const [priceHigh, setPriceHigh] = useState('');
  const [noteLow, setNoteLow] = useState('');
  const [noteMid, setNoteMid] = useState('');
  const [noteHigh, setNoteHigh] = useState('');
  const defaultProducts = [['egg', 'Œuf'], ['alveole', 'Alvéole'], ['carton', 'Carton'], ['feed', 'Aliment'], ['chicken', 'Poulet'], ['others', 'Autre']] as const;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 2800);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => { listMarketPrices().then(setPrices).catch(() => {}); }, []);

  const regions = ['Toutes', ...Array.from(new Set(prices.map((p) => p.region)))];
  const filtered = region === 'Toutes' ? prices : prices.filter((p) => p.region === region);

  const handleAdd = async () => {
    const e: Record<string, string> = {};
    if (!product.trim()) e.product = 'Le produit est obligatoire.';
    const priceNum = parseFloat(price.replace(',', '.'));
    if (!price.trim() || isNaN(priceNum) || priceNum <= 0) e.price = 'Le prix doit être supérieur à zéro.';
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    try {
      const values = { product: product.trim(), product_key: productKey, region: region === 'Toutes' ? 'Non précisée' : region, price: priceNum, price_low: Number(priceLow.replace(',', '.')) || priceNum, price_mid: Number(priceMid.replace(',', '.')) || priceNum, price_high: Number(priceHigh.replace(',', '.')) || priceNum, note_low: noteLow || null, note_mid: noteMid || null, note_high: noteHigh || null, tags: productKey, unit: 'FCFA', source: 'Saisie manuelle', price_date: new Date().toISOString().slice(0, 10) };
      const saved = editingPrice ? await updateMarketPrice(editingPrice.id, values) : await createMarketPrice(values);
      setPrices((items) => editingPrice ? items.map((item) => item.id === saved.id ? saved : item) : [saved, ...items]); setShowAdd(false); setEditingPrice(null); setProduct(''); setProductKey('others'); setPrice(''); setPriceLow(''); setPriceMid(''); setPriceHigh(''); setNoteLow(''); setNoteMid(''); setNoteHigh('');
      setToast(editingPrice ? 'Prix modifié.' : 'Prix enregistré.');
    } catch (error) { Alert.alert('Erreur', error instanceof Error ? error.message : 'Impossible d’enregistrer le prix.'); }
    finally { setSaving(false); }
  };

  const refresh = async () => { try { setPrices(await refreshMarketPrices()); setToast('Prix actualisés depuis la source configurée.'); } catch (error) { Alert.alert('Actualisation impossible', error instanceof Error ? error.message : 'Configurez une source HTTPS.'); } };

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Prix du marché" onBack={() => router.back()} />
      {toast !== '' && (
        <View style={styles.toast}>
          <MaterialIcons name="check-circle" size={16} color={Colors.primary} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
      <ScrollView contentContainerStyle={styles.scroll} showsHorizontalScrollIndicator={false} horizontal={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {regions.map((r) => (
            <TouchableOpacity key={r} style={[styles.chip, region === r && styles.chipActive]} onPress={() => setRegion(r)}>
              <Text style={[styles.chipText, region === r && styles.chipTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="payments" size={44} color={Colors.outline} />
            <Text style={styles.emptyTitle}>Aucun prix pour cette région</Text>
            <Text style={styles.emptyText}>Ajoutez le premier prix du marché pour {region}.</Text>
          </View>
        ) : (
          filtered.map((p) => (
            <View key={p.id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.product}>{p.product}</Text>
                <Text style={styles.validUntil}>{p.source} • {p.price_date}</Text>
              </View>
              <View style={styles.priceActions}><Text style={styles.price}>{fmtInt(p.price_mid ?? p.price)} {p.unit}</Text><TouchableOpacity onPress={() => { setEditingPrice(p); setProduct(p.product); setProductKey(p.product_key ?? 'others'); setPrice(String(p.price)); setPriceLow(String(p.price_low ?? p.price)); setPriceMid(String(p.price_mid ?? p.price)); setPriceHigh(String(p.price_high ?? p.price)); setNoteLow(p.note_low ?? ''); setNoteMid(p.note_mid ?? ''); setNoteHigh(p.note_high ?? ''); setShowAdd(true); }} hitSlop={8}><MaterialIcons name="edit" size={18} color={Colors.primary} /></TouchableOpacity></View>
            </View>
          ))
        )}

        <PrimaryButton label="Actualiser depuis Internet" icon="sync" onPress={refresh} />
        <PrimaryButton label="Ajouter un prix" icon="add" onPress={() => setShowAdd(true)} />
      </ScrollView>

      <Modal transparent animationType="slide" visible={showAdd} onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingPrice ? 'Modifier le prix' : 'Ajouter un prix'} ({region})</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)} hitSlop={10}>
                <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
            <FormField label="Produit" icon="shopping-cart" placeholder="Ex : Alvéole (30 œufs)" value={product} onChangeText={(t) => { setProduct(t); if (errors.product) setErrors({ ...errors, product: '' }); }} />
            {errors.product !== '' && errors.product !== undefined && <Text style={styles.errorText}>{errors.product}</Text>}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.productTags}>{defaultProducts.map(([key, label]) => <TouchableOpacity key={key} style={[styles.productTag, productKey === key && styles.productTagActive]} onPress={() => { setProductKey(key); if (key !== 'others') setProduct(label); }}><Text style={productKey === key ? styles.productTagTextActive : styles.productTagText}>{label}</Text></TouchableOpacity>)}</ScrollView>
            <FormField label="Prix unitaire" icon="payments" placeholder="Ex : 2500" keyboardType="number-pad" value={price} onChangeText={(t) => { setPrice(t); if (errors.price) setErrors({ ...errors, price: '' }); }} suffix="FCFA" />
            {errors.price !== '' && errors.price !== undefined && <Text style={styles.errorText}>{errors.price}</Text>}
            <Text style={styles.tierTitle}>Trois niveaux de prix (optionnels)</Text>
            {([['Bas', priceLow, setPriceLow, noteLow, setNoteLow], ['Moyen', priceMid, setPriceMid, noteMid, setNoteMid], ['Haut', priceHigh, setPriceHigh, noteHigh, setNoteHigh]] as const).map(([label, value, setValue, note, setNote]) => <View key={label} style={styles.tierRow}><Text style={styles.tierLabel}>{label}</Text><TextInput style={styles.tierInput} placeholder="Prix" keyboardType="decimal-pad" value={value} onChangeText={setValue} /><TextInput style={styles.tierNote} placeholder="Note" value={note} onChangeText={setNote} /></View>)}
            <PrimaryButton label={saving ? 'Enregistrement...' : editingPrice ? 'Enregistrer les modifications' : 'Enregistrer le prix'} onPress={handleAdd} disabled={saving} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  toast: { position: 'absolute', top: 14, left: 16, right: 16, zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(13,99,27,0.12)', borderRadius: Radius.DEFAULT, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(13,99,27,0.2)' },
  toastText: { color: Colors.primary, fontSize: 12.5, fontWeight: '700', flexShrink: 1 },
  scroll: { padding: Spacing.containerPadding, paddingBottom: 40, gap: Spacing.stackGap },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerHigh, borderWidth: 1, borderColor: Colors.outlineVariant },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Typography.labelLg, color: Colors.onSurfaceVariant },
  chipTextActive: { color: Colors.onPrimary },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.outlineVariant, padding: 16, ...Shadow.sm },
  priceActions: { alignItems: 'flex-end', gap: 6 },
  product: { fontWeight: '700', fontSize: 14, color: Colors.onSurface },
  validUntil: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 4 },
  price: { fontWeight: '800', fontSize: 16, color: Colors.primary },
  empty: { alignItems: 'center', paddingVertical: 50, gap: 8 },
  emptyTitle: { ...Typography.headlineMd, fontSize: 17, color: Colors.onSurface },
  emptyText: { fontSize: 13, color: Colors.onSurfaceVariant, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.surfaceContainerLowest, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.containerPadding, paddingBottom: 40, gap: 14 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { ...Typography.headlineMd, fontSize: 20, color: Colors.onSurface },
  errorText: { color: Colors.error, fontSize: 12, marginTop: -8, marginBottom: 8, marginLeft: 4 },
  productTags: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  productTag: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerHigh, borderWidth: 1, borderColor: Colors.outlineVariant },
  productTagActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  productTagText: { color: Colors.onSurfaceVariant, fontSize: 12, fontWeight: '700' },
  productTagTextActive: { color: Colors.onPrimary, fontSize: 12, fontWeight: '700' },
  tierTitle: { ...Typography.labelLg, color: Colors.onSurfaceVariant },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tierLabel: { width: 42, color: Colors.onSurfaceVariant, fontSize: 12, fontWeight: '700' },
  tierInput: { width: 82, borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.sm, padding: 9, color: Colors.onSurface },
  tierNote: { flex: 1, borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.sm, padding: 9, color: Colors.onSurface },
});