// app/setup.tsx
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/design-system';
import { FormField } from '@/components/ui/FormField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { createFarm, createFlock } from '@/lib/api';

const STEPS = ['Ferme', 'Bande', 'Stocks', 'Récap'];

const BREEDS = ['Pondeuses Isa Brown', 'Pondeuses Lohmann', 'Poulets de chair Cobb 500', 'Autre'];

const pad = (n: number) => String(n).padStart(2, '0');
const formatFr = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const formatNumber = (v: number) => v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const convertEggs = (total: number): string => {
  const cartons = Math.floor(total / 360);
  const alveoles = Math.floor((total % 360) / 30);
  const eggs = total % 30;
  return `${cartons} cartons, ${alveoles} alvéoles, ${eggs} œufs`;
};

export default function SetupScreen() {
  const [step, setStep] = useState(0);

  // Étape 1 : Ferme
  const [farmName, setFarmName] = useState('');
  const [farmLocation, setFarmLocation] = useState('');

  // Étape 2 : Bande
  const [breed, setBreed] = useState(BREEDS[0]);
  const [birdCount, setBirdCount] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [skipFlock, setSkipFlock] = useState(false);

  // Étape 3 : Stocks initiaux (optionnel)
  const [feedStock, setFeedStock] = useState('');
  const [eggStock, setEggStock] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const eggStockNum = parseInt(eggStock, 10) || 0;

  /* ----- Navigation entre étapes ----- */
  const next = () => {
    if (step === 0) {
      if (!farmName.trim()) {
        setErrors({ farmName: 'Le nom de la ferme est obligatoire.' });
        return;
      }
    }
    if (step === 1 && !skipFlock) {
      const e: Record<string, string> = {};
      const c = parseInt(birdCount, 10);
      if (!birdCount.trim() || isNaN(c) || c <= 0) e.birdCount = "L'effectif initial doit être supérieur à zéro.";
      if (startDate.getTime() > Date.now()) e.date = 'La date ne mise en place ne peut pas être dans le futur.';
      if (Object.keys(e).length) {
        setErrors(e);
        return;
      }
    }
    setErrors({});
    setStep((s) => Math.min(s + 1, 3));
  };

  const back = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  };

  const onDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selected) setStartDate(selected);
  };

  /* ----- Persistance réelle de la ferme et de la première bande ----- */
  const finish = async () => {
    setSaving(true);
    try {
      const farm = await createFarm({ name: farmName.trim(), location: farmLocation.trim() || undefined });
      const flocks = skipFlock ? [] : [await createFlock({ farm_id: farm.id, breed, bird_count: parseInt(birdCount, 10), start_date: startDate.toISOString().slice(0, 10) })];
      const stocks = {
        aliments: parseFloat(feedStock.replace(',', '.')) || 0,
        oeufs: eggStockNum,
      };

      await AsyncStorage.setItem('setup_done', '1');
      await AsyncStorage.setItem('my_farm', JSON.stringify(farm));
      await AsyncStorage.setItem('my_flocks', JSON.stringify(flocks));
      await AsyncStorage.setItem('my_stocks', JSON.stringify(stocks));

      Alert.alert('Configuration terminée 🎉', `Bienvenue dans ${farm.name}. Votre application est prête !`, [
        { text: 'Commencer', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch {
      Alert.alert('Erreur', 'Impossible de terminer la configuration. Veuillez réessayer.');
      setSaving(false);
    }
  };

  /* ----- Indicateur d'étapes ----- */
  const renderSteps = () => (
    <View style={styles.stepsRow}>
      {STEPS.map((s, i) => (
        <View key={s} style={styles.stepItem}>
          <View style={[styles.stepDot, i <= step && styles.stepDotActive]}>
            {i < step ? (
              <MaterialIcons name="check" size={12} color={Colors.onPrimary} />
            ) : (
              <Text style={[styles.stepDotText, i <= step && styles.stepDotTextActive]}>{i + 1}</Text>
            )}
          </View>
          <Text style={[styles.stepLabel, i <= step && styles.stepLabelActive]}>{s}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.logo}>
            <MaterialIcons name="agriculture" size={30} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Bienvenue ! Configurons votre ferme</Text>
          <Text style={styles.subtitle}>
            Quelques informations pour préparer votre tableau de bord. Vous pourrez tout modifier plus tard.
          </Text>
        </View>

        {renderSteps()}

        {/* ---------- ÉTAPE 1 : FERME ---------- */}
        {step === 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ma ferme</Text>
            <FormField
              label="Nom de la ferme"
              icon="business"
              placeholder="Ex : Ferme de Mbankomo"
              value={farmName}
              onChangeText={(t) => { setFarmName(t); if (errors.farmName) setErrors({ ...errors, farmName: '' }); }}
            />
            {errors.farmName !== '' && errors.farmName !== undefined && <Text style={styles.errorText}>{errors.farmName}</Text>}
            <FormField
              label="Localisation (ville, région)"
              icon="location-on"
              placeholder="Ex : Mbankomo, Centre"
              value={farmLocation}
              onChangeText={setFarmLocation}
            />
          </View>
        )}

        {/* ---------- ÉTAPE 2 : PREMIÈRE BANDE ---------- */}
        {step === 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ma première bande</Text>

            {skipFlock ? (
              <View style={styles.skipNote}>
                <MaterialIcons name="info-outline" size={18} color={Colors.onSurfaceVariant} />
                <Text style={styles.skipNoteText}>
                  Étape ignorée. Vous pourrez créer vos bandes plus tard depuis le menu Bandes.
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.label}>Type de volailles</Text>
                <View style={styles.chipRow}>
                  {BREEDS.map((b) => (
                    <TouchableOpacity key={b} style={[styles.chip, breed === b && styles.chipActive]} onPress={() => setBreed(b)}>
                      <Text style={[styles.chipText, breed === b && styles.chipTextActive]}>{b}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Effectif initial</Text>
                <View style={styles.inputRow}>
                  <TextInput style={styles.inputRight} keyboardType="number-pad" placeholder="Ex : 5000" value={birdCount} onChangeText={(t) => { setBirdCount(t); if (errors.birdCount) setErrors({ ...errors, birdCount: '' }); }} />
                  <Text style={styles.inputSuffix}>sujets</Text>
                </View>
                {errors.birdCount !== '' && errors.birdCount !== undefined && <Text style={styles.errorText}>{errors.birdCount}</Text>}

                <Text style={styles.label}>Date de mise en place</Text>
                <TouchableOpacity style={styles.dateBox} onPress={() => setShowPicker(true)} activeOpacity={0.8}>
                  <MaterialIcons name="calendar-today" size={16} color={Colors.onSurfaceVariant} />
                  <Text style={styles.dateText}>{formatFr(startDate)}</Text>
                </TouchableOpacity>
                {errors.date !== '' && errors.date !== undefined && <Text style={styles.errorText}>{errors.date}</Text>}
                {showPicker && (
                  <View style={{ marginTop: 8 }}>
                    <DateTimePicker value={startDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} maximumDate={new Date()} onChange={onDateChange} />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity onPress={() => setShowPicker(false)} style={styles.pickerClose}>
                        <Text style={styles.pickerCloseText}>Fermer</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* ---------- ÉTAPE 3 : STOCKS INITIAUX ---------- */}
        {step === 2 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mes stocks de départ (optionnel)</Text>

            <Text style={styles.label}>Aliments en réserve</Text>
            <View style={styles.inputRow}>
              <TextInput style={styles.inputRight} keyboardType="decimal-pad" placeholder="0,0" value={feedStock} onChangeText={setFeedStock} />
              <Text style={styles.inputSuffix}>kg</Text>
            </View>

            <Text style={styles.label}>Œufs en stock</Text>
            <View style={styles.inputRow}>
              <TextInput style={styles.inputRight} keyboardType="number-pad" placeholder="0" value={eggStock} onChangeText={setEggStock} />
              <Text style={styles.inputSuffix}>unités</Text>
            </View>
            {eggStockNum > 0 && <Text style={styles.conversionText}>= {convertEggs(eggStockNum)}</Text>}
          </View>
        )}

        {/* ---------- ÉTAPE 4 : RÉCAP ---------- */}
        {step === 3 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Récapitulatif</Text>

            <View style={styles.recapRow}>
              <MaterialIcons name="business" size={18} color={Colors.primary} />
              <Text style={styles.recapText}>{farmName}{farmLocation ? ` — ${farmLocation}` : ''}</Text>
            </View>
            <View style={styles.recapRow}>
              <MaterialIcons name="pets" size={18} color={Colors.primary} />
              <Text style={styles.recapText}>
                {skipFlock ? 'Aucune bande pour le moment' : `${breed} — ${formatNumber(parseInt(birdCount, 10) || 0)} sujets (mise en place le ${formatFr(startDate)})`}
              </Text>
            </View>
            <View style={styles.recapRow}>
              <MaterialIcons name="inventory-2" size={18} color={Colors.primary} />
              <Text style={styles.recapText}>
                {feedStock || eggStock
                  ? `Stocks : ${feedStock ? `${feedStock} kg d'aliments` : ''}${feedStock && eggStock ? ', ' : ''}${eggStock ? `${formatNumber(eggStockNum)} œufs` : ''}`
                  : 'Aucun stock initial renseigné'}
              </Text>
            </View>

            <View style={styles.infoBanner}>
              <MaterialIcons name="lightbulb" size={16} color={Colors.warning} />
              <Text style={styles.infoBannerText}>
                Astuce : vous pourrez ajouter d&apos;autres fermes, bandes et membres depuis le menu.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ---------- BARRE D'ACTIONS ---------- */}
      <View style={styles.actionBar}>
        {step > 0 && (
          <TouchableOpacity style={styles.backBtn} onPress={back}>
            <MaterialIcons name="arrow-back" size={18} color={Colors.onSurfaceVariant} />
            <Text style={styles.backText}>Retour</Text>
          </TouchableOpacity>
        )}

        {step === 1 && !skipFlock && (
          <TouchableOpacity style={styles.skipBtn} onPress={() => { setSkipFlock(true); setErrors({}); setStep(2); }}>
            <Text style={styles.skipText}>Ignorer cette étape</Text>
          </TouchableOpacity>
        )}
        {step === 2 && (
          <TouchableOpacity style={styles.skipBtn} onPress={() => { setErrors({}); setStep(3); }}>
            <Text style={styles.skipText}>Passer</Text>
          </TouchableOpacity>
        )}

        <View style={{ flex: 1 }}>
          <PrimaryButton
            label={step < 3 ? 'Continuer' : saving ? 'Configuration...' : 'Terminer la configuration'}
            icon={step < 3 ? 'arrow-forward' : saving ? undefined : 'check-circle'}
            onPress={step < 3 ? next : finish}
            disabled={saving}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.containerPadding, paddingBottom: 120 },
  header: { alignItems: 'center', marginTop: 24, marginBottom: 28 },
  logo: { width: 72, height: 72, borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { ...Typography.headlineLg, fontSize: 24, color: Colors.onSurface, textAlign: 'center' },
  subtitle: { ...Typography.bodyMd, fontSize: 14, color: Colors.onSurfaceVariant, textAlign: 'center', marginTop: 8, maxWidth: 320 },
  stepsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, paddingHorizontal: 8 },
  stepItem: { alignItems: 'center', gap: 6, flex: 1 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: Colors.primary },
  stepDotText: { fontSize: 12, fontWeight: '700', color: Colors.onSurfaceVariant },
  stepDotTextActive: { color: Colors.onPrimary },
  stepLabel: { fontSize: 11, fontWeight: '600', color: Colors.onSurfaceVariant },
  stepLabelActive: { color: Colors.primary },
  card: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.outlineVariant, padding: 18, ...Shadow.card },
  cardTitle: { ...Typography.headlineMd, fontSize: 17, color: Colors.onSurface, marginBottom: 16 },
  label: { ...Typography.labelLg, fontSize: 12, color: Colors.onSurfaceVariant, marginBottom: 6 },
  errorText: { color: Colors.error, fontSize: 12, marginTop: -4, marginBottom: 8, marginLeft: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerHigh, borderWidth: 1, borderColor: Colors.outlineVariant },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Typography.labelLg, fontSize: 12, color: Colors.onSurfaceVariant },
  chipTextActive: { color: Colors.onPrimary },
  inputRow: { height: Spacing.touchTargetMin, borderWidth: 1.5, borderColor: Colors.outline, borderRadius: Radius.md, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  inputRight: { flex: 1, textAlign: 'right', fontSize: 16, color: Colors.onSurface },
  inputSuffix: { marginLeft: 8, color: Colors.onSurfaceVariant, fontWeight: '600', fontSize: 13 },
  dateBox: { height: Spacing.touchTargetMin, borderWidth: 1.5, borderColor: Colors.outline, borderRadius: Radius.md, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateText: { color: Colors.onSurface, fontSize: 14, fontWeight: '600' },
  pickerClose: { alignItems: 'center', paddingVertical: 8 },
  pickerCloseText: { color: Colors.primary, fontWeight: '700' },
  conversionText: { color: Colors.primary, fontSize: 12, fontWeight: '600', marginTop: -8, marginBottom: 12 },
  skipNote: { flexDirection: 'row', gap: 10, backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.DEFAULT, padding: 14 },
  skipNoteText: { flex: 1, fontSize: 13, color: Colors.onSurfaceVariant, lineHeight: 19 },
  recapRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.surfaceVariant },
  recapText: { flex: 1, fontSize: 14, color: Colors.onSurface, lineHeight: 20 },
  infoBanner: { flexDirection: 'row', gap: 8, backgroundColor: 'rgba(217,119,6,0.08)', borderRadius: Radius.DEFAULT, padding: 12, marginTop: 16 },
  infoBannerText: { flex: 1, fontSize: 12, color: Colors.onSurface, lineHeight: 17 },
  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surfaceContainerLowest, borderTopWidth: 1, borderTopColor: Colors.outlineVariant, padding: Spacing.containerPadding, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10 },
  backText: { color: Colors.onSurfaceVariant, fontWeight: '600', fontSize: 13 },
  skipBtn: { paddingVertical: 10 },
  skipText: { color: Colors.onSurfaceVariant, fontWeight: '600', fontSize: 13, textDecorationLine: 'underline' },
});