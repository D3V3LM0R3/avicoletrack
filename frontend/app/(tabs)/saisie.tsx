// app/(tabs)/saisie.tsx
import React, { useEffect, useMemo, useState } from 'react';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/design-system';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { SelectField } from '@/components/ui/SelectField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import {
  createDailyReport,
  getCurrentUser,
  listDailyReports,
  listFlocks,
  updateDailyReport,
  type DailyReport,
  type Flock,
} from '@/lib/api';
import { enqueueOfflineItem } from '@/lib/offline-sync';

const EGGS_PER_ALVEOLE = 30;
const EGGS_PER_CARTON = EGGS_PER_ALVEOLE * 12;

const pad = (n: number) => String(n).padStart(2, '0');
const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const formatFr = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const formatNumber = (v: number) => v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const formatDateTime = (value?: string) => value ? new Date(value).toLocaleString('fr-FR') : 'Heure indisponible';
const fmtDec = (v: number, digits = 1) => v.toFixed(digits).replace('.', ',');
const isNumberInput = (value: string) => value.trim() !== '' && Number.isFinite(Number(value.replace(',', '.')));

function convertEggs(total: number): string | null {
  if (!total || total <= 0) return null;
  const cartons = Math.floor(total / EGGS_PER_CARTON);
  const rem = total % EGGS_PER_CARTON;
  const alveoles = Math.floor(rem / EGGS_PER_ALVEOLE);
  const eggs = rem % EGGS_PER_ALVEOLE;
  const parts: string[] = [];
  if (cartons > 0) parts.push(`${cartons} carton${cartons > 1 ? 's' : ''}`);
  if (alveoles > 0 || cartons > 0) parts.push(`${alveoles} alvéole${alveoles > 1 ? 's' : ''}`);
  parts.push(`${eggs} œuf${eggs > 1 ? 's' : ''}`);
  return `${formatNumber(total)} œufs = ${parts.join(', ')}`;
}

/* ================= COMPOSANT ================= */

export default function SaisieScreen() {
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [createdReports, setCreatedReports] = useState<DailyReport[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingReport, setEditingReport] = useState<DailyReport | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [flockId, setFlockId] = useState('');
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const [mortalite, setMortalite] = useState('0');
  const [oeufs, setOeufs] = useState('');
  const [aliment, setAliment] = useState('');
  const [eau, setEau] = useState('10');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [duplicateModal, setDuplicateModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    getCurrentUser().then((user) => setCurrentUserId(user?.id ?? null)).catch(() => {});
    Promise.all([listFlocks(), listDailyReports()]).then(([items, reports]) => {
      setFlocks(items);
      setCreatedReports(reports);
      if (items[0]) {
        setFlockId(String(items[0].id));
      }
    }).catch(() => {});
  }, []);

  /* ----- Réseau réel (bannière hors-ligne) ----- */
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => setIsOnline(state.isConnected ?? true));
    return unsub;
  }, []);

  /* ----- Valeurs parsées ----- */
  const selectedFlock = flocks.find((flock) => String(flock.id) === flockId);
  const effectifNum = selectedFlock?.bird_count ?? 0;
  const mortaliteNum = parseInt(mortalite, 10) || 0;
  const oeufsNum = parseInt(oeufs, 10) || 0;
  const alimentNum = parseFloat(aliment.replace(',', '.')) || 0;
  const eauNum = parseFloat(eau.replace(',', '.')) || 0;

  /* ----- Calculs automatiques (CDC §2.2) ----- */
  const tauxPonte = effectifNum > 0 ? (oeufsNum / effectifNum) * 100 : null;
  const productivite = effectifNum > 0 ? oeufsNum / effectifNum : null;
  const ratio = oeufsNum > 0 ? alimentNum / oeufsNum : null;
  const conversion = useMemo(() => convertEggs(oeufsNum), [oeufsNum]);
  const bagCount = alimentNum / 50;
  const sicknessRisk = useMemo(() => {
    if (effectifNum <= 0) return null;
    const mortalityRate = (mortaliteNum / effectifNum) * 100;
    const eggRate = (oeufsNum / effectifNum) * 100;
    if (mortalityRate >= 8 || eggRate < 25) return 'Vigilance: risque de maladie ou de chute de production.';
    if (mortalityRate >= 5 || eggRate < 35) return 'Surveillance recommandée: évolution à suivre.';
    return null;
  }, [effectifNum, mortaliteNum, oeufsNum]);

  const isFuture = date.getTime() > new Date().setHours(23, 59, 59, 999);
  const isOld = date.getTime() < Date.now() - 7 * 86400000;

  /* ----- Validation (CDC §2.1 / §6.1) ----- */
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (effectifNum <= 0) e.effectif = "L'effectif de la bande doit être supérieur à zéro.";
    if (mortaliteNum < 0) e.mortalite = 'La mortalité ne peut pas être négative.';
    else if (mortaliteNum > effectifNum) e.mortalite = "La mortalité ne peut pas dépasser l'effectif.";
    if (!oeufs.trim()) e.oeufs = "Le nombre d'œufs est obligatoire.";
    else if (!isNumberInput(oeufs)) e.oeufs = "Saisissez un nombre d'œufs valide.";
    else if (oeufsNum < 0) e.oeufs = "Le nombre d'œufs ne peut pas être négatif.";
    else if (oeufsNum > effectifNum) e.oeufs = "Le nombre d'œufs ne peut pas dépasser l'effectif.";
    if (!aliment.trim()) e.aliment = "La quantité d'aliments consommée est obligatoire.";
    else if (!isNumberInput(aliment)) e.aliment = "Saisissez une quantité d'aliments valide.";
    else if (alimentNum < 0) e.aliment = "La quantité d'aliments ne peut pas être négative.";
    if (!isNumberInput(eau)) e.eau = 'Saisissez un volume d’eau valide.';
    else if (eauNum < 0) e.eau = 'Le volume d’eau ne peut pas être négatif.';
    if (isFuture) e.date = 'La date ne peut pas être dans le futur.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ----- Enregistrement ----- */
  const doSave = async () => {
    setIsSaving(true);
    try {
      if (isOnline) {
        const selectedFlock = flocks.find((flock) => String(flock.id) === flockId);
        if (!selectedFlock) throw new Error('Aucune bande valide sélectionnée.');
        const reportData = {
          farm_id: selectedFlock.farm_id,
          flock_id: selectedFlock.id,
          report_date: toDateKey(date),
          bird_count: effectifNum,
          mortality: mortaliteNum,
          eggs_produced: oeufsNum,
          egg_stock: 0,
          cartons: Math.floor(oeufsNum / EGGS_PER_CARTON),
          alveoli: Math.floor((oeufsNum % EGGS_PER_CARTON) / EGGS_PER_ALVEOLE),
          remaining_eggs: oeufsNum % EGGS_PER_ALVEOLE,
          feed_used_bags: alimentNum,
          water_used_liters: eauNum,
          notes,
        };
        const report = editingReport ? await updateDailyReport(editingReport.id!, reportData) : await createDailyReport(reportData);
        setSuccessMessage('Saisie enregistrée et synchronisée.');
        setCreatedReports((items) => editingReport ? items.map((item) => item.id === report.id ? { ...item, ...report } : item) : [{ ...report, author_name: 'Vous' }, ...items]);
        setEditingReport(null);
        resetForm();
        setShowCreate(false);
      } else {
        const selectedFlock = flocks.find((flock) => String(flock.id) === flockId);
        if (!selectedFlock) {
          throw new Error('Aucune bande valide sélectionnée.');
        }

        await enqueueOfflineItem({
          type: 'daily_report',
          createdAt: Date.now(),
          farm_id: selectedFlock.farm_id,
          flock_id: selectedFlock.id,
          report_date: toDateKey(date),
          bird_count: effectifNum,
          mortality: mortaliteNum,
          eggs_produced: oeufsNum,
          egg_stock: 0,
          cartons: Math.floor(oeufsNum / 360),
          alveoli: Math.floor((oeufsNum % 360) / 30),
          remaining_eggs: oeufsNum % 30,
          feed_used_bags: alimentNum,
          water_used_liters: eauNum,
          notes,
          created_by: null,
        });
        setSuccessMessage('Saisie enregistrée localement. Elle sera synchronisée dès que la connexion sera rétablie.');
        resetForm();
        setShowCreate(false);
      }
    } catch (error) {
      Alert.alert('Erreur', error instanceof Error ? error.message : "Impossible d'enregistrer la saisie. Veuillez réessayer.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () => {
    if (!validate()) return;
    doSave();
  };

  const resetForm = () => {
    setMortalite('0');
    setOeufs('');
    setAliment('');
    setEau('10');
    setNotes('');
    setErrors({});
  };

  const openCreate = () => {
    setEditingReport(null);
    resetForm();
    setShowCreate(true);
  };

  const openEdit = (report: DailyReport) => {
    const flock = flocks.find((item) => item.id === report.flock_id);
    setEditingReport(report);
    setFlockId(String(report.flock_id ?? flock?.id ?? ''));
    setDate(new Date(report.report_date));
    setMortalite(String(report.mortality));
    setOeufs(String(report.eggs_produced));
    setAliment(String(report.feed_used_bags ?? ''));
    setEau(String(report.water_used_liters ?? 10));
    setNotes(report.notes ?? '');
    setErrors({});
    setShowCreate(true);
  };

  const onDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selected) {
      setDate(selected);
      if (errors.date) setErrors({ ...errors, date: '' });
    }
  };

  const handleFlockChange = (name: string) => {
    const f = flocks.find((x) => `${x.breed || 'Bande'} (${x.id})` === name);
    if (f) {
      setFlockId(String(f.id));
    }
  };

  const flockOptions = flocks.map((flock) => `${flock.breed || 'Bande'} (${flock.id})`);
  const currentFlockName = flockOptions.find((name) => name.endsWith(`(${flockId})`)) || 'Chargement des bandes...';
  const filteredReports = createdReports.filter((report) => {
    const text = `${report.report_date} ${report.author_name ?? ''} ${report.notes ?? ''}`.toLowerCase();
    return text.includes(search.trim().toLowerCase());
  });

  const renderQuantityStepper = (
    label: string,
    value: string,
    onChange: (next: string) => void,
    suffix: string,
    helper?: string,
    min = 0,
  ) => {
    const numericValue = Number(value) || 0;
    return (
      <View style={{ marginBottom: 10 }}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.stepperRow}>
          <TouchableOpacity style={styles.stepperButton} onPress={() => onChange(String(Math.max(min, numericValue - 1)))}>
            <MaterialIcons name="remove" size={20} color={Colors.primary} />
          </TouchableOpacity>
          <View style={styles.stepperInputWrap}>
            <TextInput
              style={styles.inputRight}
              keyboardType="number-pad"
              value={value}
              onChangeText={onChange}
            />
            <Text style={styles.inputSuffix}>{suffix}</Text>
          </View>
          <TouchableOpacity style={styles.stepperButton} onPress={() => onChange(String(numericValue + 1))}>
            <MaterialIcons name="add" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        {helper ? <Text style={styles.helperText}>{helper}</Text> : null}
      </View>
    );
  };

  /* ================= RENDU ================= */

  return (
    <ScreenShell activeTab="saisie">
      {!showCreate ? (
        <ScrollView contentContainerStyle={styles.mainScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.mainHeader}>
            <View><Text style={styles.screenTitle}>Saisies journalières</Text><Text style={styles.screenSubtitle}>Consultez les saisies confirmées de vos bandes.</Text></View>
            <TouchableOpacity style={styles.createButton} onPress={openCreate}><MaterialIcons name="add" size={20} color={Colors.onPrimary} /><Text style={styles.createButtonText}>Créer une saisie</Text></TouchableOpacity>
          </View>
          <View style={styles.searchBox}><MaterialIcons name="search" size={20} color={Colors.outline} /><TextInput style={styles.searchInput} placeholder="Rechercher une saisie..." value={search} onChangeText={setSearch} placeholderTextColor={Colors.outline} /></View>
          {filteredReports.length === 0 ? <View style={styles.emptyBox}><MaterialIcons name="assignment" size={42} color={Colors.outline} /><Text style={styles.emptyTitle}>Aucune saisie trouvée</Text><Text style={styles.emptyText}>Créez une saisie pour commencer.</Text></View> : filteredReports.map((report) => { const canEdit = report.created_by === currentUserId && !!report.created_at && Date.now() - new Date(report.created_at).getTime() < 2 * 60 * 60 * 1000; return <View key={report.id} style={styles.reportCard}><View style={styles.reportHeader}><Text style={styles.reportTitle}>{report.report_date}</Text><Text style={styles.confirmedBadge}>Confirmée</Text></View><Text style={styles.reportMeta}>{flocks.find((flock) => flock.id === report.flock_id)?.name || `Bande ${report.flock_id ?? '-'}`}</Text><Text style={styles.reportDetails}>Effectif {formatNumber(report.bird_count)} • Mortalité {formatNumber(report.mortality)} • Œufs {formatNumber(report.eggs_produced)}</Text><Text style={styles.reportDetails}>Aliments {formatNumber(report.feed_used_bags ?? 0)} kg • Eau {formatNumber(report.water_used_liters ?? 0)} L</Text><Text style={styles.reportAuthor}>Créé par : {report.author_name || 'Vous'}</Text><Text style={styles.reportCreatedAt}>Créé le : {formatDateTime(report.created_at)}</Text>{canEdit && <TouchableOpacity style={styles.editReportButton} onPress={() => openEdit(report)}><MaterialIcons name="edit" size={16} color={Colors.primary} /><Text style={styles.editReportText}>Modifier</Text></TouchableOpacity>}</View>; })}
        </ScrollView>
      ) : (
      <Modal visible transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.createModal}><View style={styles.createModalHeader}><Text style={styles.modalTitle}>{editingReport ? 'Modifier la saisie' : 'Créer une saisie'}</Text><TouchableOpacity onPress={() => { setShowCreate(false); setEditingReport(null); }}><MaterialIcons name="close" size={24} color={Colors.onSurfaceVariant} /></TouchableOpacity></View>
      {/* Bannière hors-ligne : uniquement si vraiment hors ligne */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <MaterialIcons name="cloud-off" size={16} color="#fff" />
          <Text style={styles.offlineText}>Mode hors-ligne : enregistrement local actif</Text>
        </View>
      )}


      <ScrollView contentContainerStyle={styles.formScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.titleRow}>
          <Text style={styles.screenTitle}>Saisie journalière</Text>
          <Text style={styles.screenSubtitle}>Saisie du {formatFr(date)}</Text>
        </View>

        {/* ---------- CONTEXTE ---------- */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="label" size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Contexte</Text>
          </View>

          <SelectField label="Bande (Lot)" value={currentFlockName} options={flockOptions} onChange={handleFlockChange} />

          <Text style={styles.label}>Date de saisie</Text>
          <TouchableOpacity style={styles.dateBox} onPress={() => setShowPicker(true)} activeOpacity={0.8}>
            <MaterialIcons name="calendar-today" size={16} color={Colors.onSurfaceVariant} />
            <Text style={styles.dateText}>{formatFr(date)}</Text>
            <MaterialIcons name="edit" size={14} color={Colors.primary} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
          {errors.date ? (
            <Text style={styles.errorText}>{errors.date}</Text>
          ) : isOld ? (
            <Text style={styles.warnText}>Vous saisissez une date ancienne (plus de 7 jours). Vérifiez avant d&apos;enregistrer.</Text>
          ) : null}

          {showPicker && (
            <View style={{ marginTop: 8 }}>
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                onChange={onDateChange}
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity onPress={() => setShowPicker(false)} style={styles.pickerClose}>
                  <Text style={styles.pickerCloseText}>Fermer</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* ---------- CHEPTEL ---------- */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="pets" size={18} color={Colors.secondary} />
            <Text style={styles.sectionTitle}>Cheptel</Text>
          </View>

          <Text style={styles.label}>Effectif du jour</Text>
          <View style={styles.inputRow}>
            <Text style={styles.readonlyValue}>{effectifNum ? formatNumber(effectifNum) : 'Aucune bande sélectionnée'}</Text>
            <Text style={styles.inputSuffix}>sujets</Text>
          </View>
          {errors.effectif && <Text style={styles.errorText}>{errors.effectif}</Text>}

          {renderQuantityStepper(
            'Mortalité du jour',
            mortalite,
            (t) => { setMortalite(t); if (errors.mortalite) setErrors({ ...errors, mortalite: '' }); },
            'têtes',
            effectifNum > 0 ? `${fmtDec((mortaliteNum / effectifNum) * 100)} % du troupeau` : '0 % du troupeau',
          )}
          {errors.mortalite && <Text style={styles.errorText}>{errors.mortalite}</Text>}
        </View>

        {/* ---------- PRODUCTION ---------- */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="egg" size={18} color="#F57F17" />
            <Text style={styles.sectionTitle}>Production</Text>
          </View>

          {renderQuantityStepper(
            'Œufs collectés (total unités)',
            oeufs,
            (t) => { setOeufs(t); if (errors.oeufs) setErrors({ ...errors, oeufs: '' }); },
            'œufs',
            effectifNum > 0 ? `${fmtDec((oeufsNum / effectifNum) * 100)} % de ponte` : '0 % de ponte',
          )}
          {errors.oeufs && <Text style={styles.errorText}>{errors.oeufs}</Text>}

          <View style={styles.conversionBox}>
            <Text style={styles.conversionLabel}>Conversion automatique</Text>
            <Text style={conversion ? styles.conversionResult : styles.conversionEmpty}>
              {conversion ?? 'Entrez une valeur pour voir le stock calculé.'}
            </Text>
          </View>
        </View>

        {/* ---------- ALIMENTS & EAU ---------- */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="water-drop" size={18} color={Colors.tertiaryContainer} />
            <Text style={styles.sectionTitle}>Aliments & Eau</Text>
          </View>

          <View style={styles.fieldStack}>
            {renderQuantityStepper(
              'Aliment donné',
              aliment,
              (t) => { setAliment(t); if (errors.aliment) setErrors({ ...errors, aliment: '' }); },
              'kg',
              `≈ ${fmtDec(bagCount, 2)} sac${bagCount > 1 ? 's' : ''} de 50 kg`,
            )}
            {errors.aliment && <Text style={styles.errorText}>{errors.aliment}</Text>}
            {renderQuantityStepper(
              'Eau consommée',
              eau,
              (t) => { setEau(t); if (errors.eau) setErrors({ ...errors, eau: '' }); },
              'L',
            )}
            {errors.eau && <Text style={styles.errorText}>{errors.eau}</Text>}
          </View>
        </View>

        {/* ---------- INDICATEURS CALCULÉS (CDC §2.2) ---------- */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="insights" size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Indicateurs calculés</Text>
          </View>

          <View style={styles.indicatorRow}>
            <Text style={styles.indicatorLabel}>Taux de ponte</Text>
            <Text style={[styles.indicatorValue, tauxPonte !== null && tauxPonte < 80 && { color: Colors.error }]}>
              {tauxPonte !== null ? `${fmtDec(tauxPonte)} %` : '--'}
            </Text>
          </View>
          <View style={styles.indicatorRow}>
            <Text style={styles.indicatorLabel}>Productivité</Text>
            <Text style={styles.indicatorValue}>
              {productivite !== null ? `${fmtDec(productivite, 2)} œuf/poule` : '--'}
            </Text>
          </View>
          <View style={styles.indicatorRow}>
            <Text style={styles.indicatorLabel}>Ratio aliments / œufs</Text>
            <Text style={styles.indicatorValue}>
              {ratio !== null ? `${fmtDec(ratio, 2)} kg/œuf` : '--'}
            </Text>
          </View>
          {sicknessRisk && (
            <View style={styles.warningBox}>
              <MaterialIcons name="medical-services" size={18} color={Colors.warning} />
              <Text style={styles.warningText}>{sicknessRisk}</Text>
            </View>
          )}
        </View>

        {/* ---------- NOTES ---------- */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="edit-note" size={18} color={Colors.onSurfaceVariant} />
            <Text style={styles.sectionTitle}>Observations / Notes</Text>
          </View>
          <TextInput
            style={styles.textarea}
            multiline
            numberOfLines={3}
            maxLength={500}
            placeholder="Comportement anormal, température élevée, interventions..."
            value={notes}
            onChangeText={setNotes}
          />
        </View>
      </ScrollView>

      {/* ---------- BARRE D'ACTION ---------- */}
      <View style={styles.actionBar}>
        <PrimaryButton
          label={isSaving ? 'Enregistrement...' : isOnline ? 'Enregistrer les données' : 'Enregistrer localement'}
          icon={isSaving ? undefined : 'save'}
          onPress={handleSave}
          disabled={isSaving}
        />
      </View>

      {/* ---------- MODAL DOUBLON ---------- */}
      <Modal transparent animationType="fade" visible={duplicateModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <MaterialIcons name="warning" size={28} color={Colors.warning} />
            <Text style={styles.modalTitle}>Rapport déjà existant</Text>
            <Text style={styles.modalText}>
              Une saisie existe déjà pour cette bande à la date du {formatFr(date)}.
            </Text>
            <PrimaryButton label="Ouvrir le rapport existant" onPress={() => setDuplicateModal(false)} />
            <TouchableOpacity onPress={() => setDuplicateModal(false)} style={styles.modalCancel}>
              <Text style={styles.modalCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
        </View>
      </Modal>
      )}
      <Modal transparent animationType="fade" visible={successMessage !== ''} onRequestClose={() => setSuccessMessage('')}>
        <View style={styles.modalOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIcon}><MaterialIcons name="check" size={28} color={Colors.onPrimary} /></View>
            <Text style={styles.successTitle}>Saisie créée</Text>
            <Text style={styles.modalText}>{successMessage}</Text>
            <PrimaryButton label="OK" icon="check" onPress={() => setSuccessMessage('')} />
          </View>
        </View>
      </Modal>
    </ScreenShell>  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  offlineBanner: { backgroundColor: Colors.warning, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.containerPadding, paddingVertical: 8 },
  offlineText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  mainScroll: { padding: Spacing.containerPadding, paddingBottom: 120, gap: Spacing.stackGap },
  mainHeader: { gap: 16 },
  createButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 14 },
  createButtonText: { color: Colors.onPrimary, fontWeight: '800', fontSize: 15 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.md, paddingHorizontal: 12, backgroundColor: Colors.surfaceContainerLowest },
  searchInput: { flex: 1, color: Colors.onSurface, fontSize: 14 },
  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 48 },
  emptyTitle: { ...Typography.titleMedium, color: Colors.onSurface },
  emptyText: { ...Typography.bodySmall, color: Colors.onSurfaceVariant },
  reportCard: { backgroundColor: Colors.surfaceContainerLowest, borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.md, padding: 16, gap: 7, ...Shadow.card },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reportTitle: { ...Typography.titleMedium, color: Colors.onSurface },
  confirmedBadge: { color: Colors.tertiary, backgroundColor: Colors.tertiaryFixed, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full, fontSize: 11, fontWeight: '800' },
  reportMeta: { color: Colors.primary, fontWeight: '700', fontSize: 13 },
  reportDetails: { color: Colors.onSurfaceVariant, fontSize: 13 },
  reportAuthor: { color: Colors.onSurfaceVariant, fontSize: 12, marginTop: 3 },
  reportCreatedAt: { color: Colors.onSurfaceVariant, fontSize: 12 },
  editReportButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6, paddingVertical: 9, borderTopWidth: 1, borderTopColor: Colors.outlineVariant },
  editReportText: { color: Colors.primary, fontSize: 13, fontWeight: '800' },
  createModal: { flex: 1, marginTop: 48, backgroundColor: Colors.background, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, overflow: 'hidden' },
  createModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.containerPadding, paddingVertical: 14, backgroundColor: Colors.surfaceContainerLowest, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant },
  scroll: { padding: Spacing.containerPadding, paddingBottom: 120, gap: Spacing.stackGap },
  formScroll: { padding: Spacing.containerPadding, paddingBottom: 116, gap: Spacing.stackGap },
  titleRow: { marginBottom: 4 },
  screenTitle: { ...Typography.headlineMd, fontSize: 22, color: Colors.onBackground },
  screenSubtitle: { ...Typography.bodyMd, fontSize: 13, color: Colors.onSurfaceVariant, marginTop: 4 },
  section: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.md, padding: 18, ...Shadow.card },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionTitle: { ...Typography.headlineMd, fontSize: 17, color: Colors.onSurface },
  label: { ...Typography.labelLg, fontSize: 12, color: Colors.onSurfaceVariant, marginBottom: 6 },
  dateBox: { height: Spacing.touchTargetMin, borderWidth: 1.5, borderColor: Colors.outline, borderRadius: Radius.md, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateText: { color: Colors.onSurface, fontSize: 14, fontWeight: '600' },
  pickerClose: { alignItems: 'center', paddingVertical: 8 },
  pickerCloseText: { color: Colors.primary, fontWeight: '700' },
  errorText: { color: Colors.error, fontSize: 12, marginTop: 4, marginLeft: 4 },
  warnText: { color: Colors.warning, fontSize: 12, marginTop: 4, marginLeft: 4 },
  inputRow: { height: Spacing.touchTargetMin, borderWidth: 1.5, borderColor: Colors.outline, borderRadius: Radius.md, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  inputRight: { flex: 1, minWidth: 0, width: 0, textAlign: 'left', fontSize: 16, color: Colors.onSurface, paddingHorizontal: 0 },
  readonlyValue: { flex: 1, fontSize: 16, color: Colors.onSurface, fontWeight: '700' },
  inputSuffix: { marginLeft: 8, color: Colors.onSurfaceVariant, fontWeight: '600', fontSize: 13 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  stepperButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  stepperInputWrap: { flex: 1, minWidth: 0, height: Spacing.touchTargetMin, borderWidth: 1.5, borderColor: Colors.outline, borderRadius: Radius.md, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  helperText: { color: Colors.onSurfaceVariant, fontSize: 12, marginTop: 4, marginBottom: 6 },
  conversionBox: { backgroundColor: Colors.surfaceContainerHigh, borderRadius: Radius.DEFAULT, borderWidth: 1, borderColor: 'rgba(191,202,186,0.3)', padding: 14 },
  conversionLabel: { fontSize: 11, color: Colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  conversionResult: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  conversionEmpty: { color: Colors.onSurfaceVariant, fontStyle: 'italic', fontSize: 13 },
  row2: { flexDirection: 'row', gap: Spacing.gridGutter },
  flex1: { flex: 1 },
  fieldStack: { gap: 4 },
  indicatorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.surfaceVariant },
  indicatorLabel: { ...Typography.bodyMd, fontSize: 14, color: Colors.onSurfaceVariant },
  indicatorValue: { ...Typography.bodyMd, fontSize: 15, fontWeight: '700', color: Colors.onSurface },
  warningBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255, 190, 11, 0.12)', borderRadius: Radius.md, padding: 12, marginTop: 10 },
  warningText: { flex: 1, color: Colors.onSurface, fontSize: 13, fontWeight: '600' },
  textarea: { borderWidth: 1.5, borderColor: Colors.outline, borderRadius: Radius.md, padding: 14, minHeight: 90, textAlignVertical: 'top', color: Colors.onSurface, fontSize: 14 },
  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surfaceContainerLowest, borderTopWidth: 1, borderTopColor: Colors.outlineVariant, padding: Spacing.containerPadding },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.lg, padding: 24, width: '100%', alignItems: 'center', gap: 12 },
  successCard: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.lg, padding: 24, width: '100%', alignItems: 'center', gap: 12, ...Shadow.card },
  successIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  successTitle: { ...Typography.headlineMd, fontSize: 20, color: Colors.primary },
  modalTitle: { ...Typography.headlineMd, fontSize: 18, color: Colors.onSurface },
  modalText: { ...Typography.bodyMd, fontSize: 14, color: Colors.onSurfaceVariant, textAlign: 'center' },
  modalCancel: { paddingVertical: 10 },
  modalCancelText: { color: Colors.onSurfaceVariant, fontWeight: '600' },
});