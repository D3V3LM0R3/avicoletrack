// app/parametres/index.tsx
import React, { useCallback, useState } from 'react';
import { Alert, Linking, Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/design-system';
import { SubScreenHeader } from '@/components/ui/SubScreenHeader';
import { FormField } from '@/components/ui/FormField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { clearAuthToken } from '@/lib/auth-storage';
import { updateProfile } from '@/lib/api';
import { flushOfflineQueue, LAST_SYNC_KEY } from '@/lib/offline-sync';
import { usePreferences } from '@/lib/app-preferences';
import { getItem, removeItem, setItem } from '@/lib/storage';

const pad = (n: number) => String(n).padStart(2, '0');
const formatDateTime = (ts: number) => {
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function ParametresScreen() {
  const { language: activeLanguage, theme: activeTheme, setLanguage, setTheme: setAppTheme } = usePreferences();
  const [userName, setUserName] = useState('Utilisateur');
  const [userEmail, setUserEmail] = useState('');
  const [lang, setLang] = useState<'fr' | 'en'>('fr');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [lowData, setLowData] = useState(false);
  const [notifCrit, setNotifCrit] = useState(true);
  const [notifStock, setNotifStock] = useState(true);
  const [notifProd, setNotifProd] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [newName, setNewName] = useState('');
  const [showLogout, setShowLogout] = useState(false);
  const [showFaq, setShowFaq] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          const raw = await getItem('user_data');
          if (raw) {
            const u = JSON.parse(raw);
            if (u.name) setUserName(u.name);
            if (u.email) setUserEmail(u.email);
          }
          const ls = await getItem(LAST_SYNC_KEY);
          setLastSync(ls ? formatDateTime(parseInt(ls, 10)) : null);
          const queue = JSON.parse((await getItem('sync_queue')) || '[]');
          setPendingCount(Array.isArray(queue) ? queue.length : 0);
          setLang(activeLanguage);
          setTheme(activeTheme);
          setLowData((await getItem('pref_lowdata')) === '1');
          setNotifCrit((await getItem('pref_notif_crit')) !== '0');
          setNotifStock((await getItem('pref_notif_stock')) !== '0');
          setNotifProd((await getItem('pref_notif_prod')) === '1');
        } catch {}
      };
      load();
      const unsub = NetInfo.addEventListener((s) => setIsOnline(s.isConnected ?? true));
      return unsub;
    }, [activeLanguage, activeTheme])
  );

  const savePref = (key: string, val: string) => setItem(key, val).catch(() => {});

  const initials = userName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  /* ----- Langue / thème : persistés, traduction complète à venir ----- */
  const changeLang = (l: 'fr' | 'en') => {
    setLang(l);
    setLanguage(l);
    savePref('pref_lang', l);
  };

  const changeTheme = (t: 'light' | 'dark') => {
    setTheme(t);
    setAppTheme(t);
    savePref('pref_theme', t);
  };

  /* ----- Synchronisation rapide ----- */
  const handleSyncNow = async () => {
    if (!isOnline) {
      Alert.alert('Hors ligne', 'Une connexion est requise. Vos données restent en sécurité sur cet appareil.');
      return;
    }
    setSyncing(true);
    try {
      const result = await flushOfflineQueue();
      const now = Date.now();
      await setItem(LAST_SYNC_KEY, String(now));
      const queue = JSON.parse((await getItem('sync_queue')) || '[]');
      setPendingCount(queue.length);
      setLastSync(formatDateTime(now));
      Alert.alert('Succès', result.synced > 0 ? `Synchronisation terminée (${result.synced} élément${result.synced > 1 ? 's' : ''}).` : 'Aucune donnée à synchroniser.');
    } catch (error) {
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Synchronisation impossible.');
    } finally {
      setSyncing(false);
    }
  };

  /* ----- Profil ----- */
  const saveProfile = async () => {
    if (!newName.trim()) return;
    try {
      const user = await updateProfile(newName.trim());
      await setItem('user_data', JSON.stringify(user));
      setUserName(user.name);
      setShowEdit(false);
      Alert.alert('Succès', 'Profil mis à jour.');
    } catch (error) {
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Impossible de mettre à jour le profil.');
    }
  };

  /* ----- Déconnexion sécurisée ----- */
  const handleLogout = async () => {
    setShowLogout(false);
    await Promise.all([clearAuthToken(), removeItem('user_data')]);
    router.replace('/(auth)/login');
  };

  const ToggleRow = ({ icon, label, value, onChange }: { icon: any; label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <View style={styles.toggleRow}>
      <MaterialIcons name={icon} size={20} color={Colors.onSurfaceVariant} />
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.surfaceVariant, true: Colors.primaryContainer }}
        thumbColor={value ? Colors.primary : Colors.surfaceContainerLowest}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Paramètres" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* PROFIL DYNAMIQUE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profil</Text>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{userName}</Text>
              <Text style={styles.profileEmail}>{userEmail}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.outlineBtn} activeOpacity={0.8} onPress={() => { setNewName(userName); setShowEdit(true); }}>
            <MaterialIcons name="edit" size={16} color={Colors.secondary} />
            <Text style={styles.outlineBtnText}>Modifier le profil</Text>
          </TouchableOpacity>
        </View>

        {/* PRÉFÉRENCES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Préférences</Text>

          <Text style={styles.fieldLabel}>Langue</Text>
          <View style={styles.segment}>
            <TouchableOpacity style={[styles.segmentBtn, lang === 'fr' && styles.segmentBtnActive]} onPress={() => changeLang('fr')}>
              <Text style={[styles.segmentText, lang === 'fr' && styles.segmentTextActive]}>Français</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.segmentBtn, lang === 'en' && styles.segmentBtnActive]} onPress={() => changeLang('en')}>
              <Text style={[styles.segmentText, lang === 'en' && styles.segmentTextActive]}>English</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Thème</Text>
          <View style={styles.segment}>
            <TouchableOpacity style={[styles.segmentBtn, theme === 'light' && styles.segmentBtnActive]} onPress={() => changeTheme('light')}>
              <MaterialIcons name="light-mode" size={16} color={theme === 'light' ? Colors.primary : Colors.onSurfaceVariant} />
              <Text style={[styles.segmentText, theme === 'light' && styles.segmentTextActive]}>Clair</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.segmentBtn, theme === 'dark' && styles.segmentBtnActive]} onPress={() => changeTheme('dark')}>
              <MaterialIcons name="dark-mode" size={16} color={theme === 'dark' ? Colors.primary : Colors.onSurfaceVariant} />
              <Text style={[styles.segmentText, theme === 'dark' && styles.segmentTextActive]}>Sombre</Text>
            </TouchableOpacity>
          </View>

          {/* Mode faible data (CDC §5.1) */}
          <View style={{ marginTop: 8 }}>
            <ToggleRow icon="data-saver-off" label="Mode faible data" value={lowData} onChange={(v) => { setLowData(v); savePref('pref_lowdata', v ? '1' : '0'); }} />
          </View>
        </View>

        {/* NOTIFICATIONS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <ToggleRow icon="priority-high" label="Alertes critiques (mortalité)" value={notifCrit} onChange={(v) => { setNotifCrit(v); savePref('pref_notif_crit', v ? '1' : '0'); }} />
          <ToggleRow icon="inventory-2" label="Alertes de stock" value={notifStock} onChange={(v) => { setNotifStock(v); savePref('pref_notif_stock', v ? '1' : '0'); }} />
          <ToggleRow icon="trending-down" label="Alertes de production" value={notifProd} onChange={(v) => { setNotifProd(v); savePref('pref_notif_prod', v ? '1' : '0'); }} />
        </View>

        {/* DONNÉES & SYNC */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Données & Sync</Text>
          <Text style={styles.syncMeta}>Dernière synchronisation : {lastSync ?? 'jamais'}</Text>
          <Text style={[styles.pendingText, pendingCount > 0 ? styles.pendingTextWarning : styles.pendingTextOk]}>
            {pendingCount > 0 ? `${pendingCount} élément${pendingCount > 1 ? 's' : ''} en attente de synchronisation` : 'Toutes les données sont synchronisées'}
          </Text>
          <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85} onPress={handleSyncNow} disabled={syncing}>
            <MaterialIcons name="cloud-sync" size={18} color={Colors.onPrimary} />
            <Text style={styles.primaryBtnText}>{syncing ? 'Synchronisation...' : 'Synchroniser maintenant'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.outlineBtn, { marginTop: 10, borderColor: Colors.outline }]} activeOpacity={0.8} onPress={() => router.push('/sync')}>
            <MaterialIcons name="queue" size={16} color={Colors.onSurface} />
            <Text style={[styles.outlineBtnText, { color: Colors.onSurface }]}>Voir la file d&apos;attente</Text>
          </TouchableOpacity>
        </View>

        {/* SÉCURITÉ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sécurité</Text>
          <TouchableOpacity style={styles.helpRow} onPress={() => Alert.alert('Mot de passe', 'Le changement de mot de passe sera disponible avec le backend (endpoint dédié).')}>
            <View style={styles.helpRowLeft}>
              <MaterialIcons name="key" size={20} color={Colors.outline} />
              <Text style={styles.helpText}>Changer le mot de passe</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
          </TouchableOpacity>
        </View>

        {/* AIDE & SUPPORT */}
        <View style={styles.helpCard}>
          <Text style={[styles.sectionTitle, { padding: 16, paddingBottom: 8 }]}>Aide & Support</Text>
          <TouchableOpacity style={styles.helpRow} activeOpacity={0.7} onPress={() => setShowFaq(true)}>
            <View style={styles.helpRowLeft}>
              <MaterialIcons name="help" size={20} color={Colors.outline} />
              <Text style={styles.helpText}>FAQ & Tutoriels</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.helpRow, { borderBottomWidth: 0 }]} activeOpacity={0.7} onPress={() => Linking.openURL('mailto:support@avicoletrack.cm')}>
            <View style={styles.helpRowLeft}>
              <MaterialIcons name="support-agent" size={20} color={Colors.outline} />
              <Text style={styles.helpText}>Contacter le support</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
          </TouchableOpacity>
        </View>

        {/* À PROPOS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>À propos</Text>
          <View style={styles.aboutRow}>
            <Text style={styles.helpText}>Version</Text>
            <Text style={styles.helpText}>1.0.0 (beta)</Text>
          </View>
          <TouchableOpacity style={styles.aboutRow} onPress={() => Alert.alert('Conditions d\'utilisation', 'Document complet disponible sur avicoletrack.cm/cgu.')}>
            <Text style={styles.helpText}>Conditions d&apos;utilisation</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.aboutRow} onPress={() => Alert.alert('Confidentialité', 'Vos données sont chiffrées et hébergées conformément à la politique de confidentialité.')}>
            <Text style={styles.helpText}>Politique de confidentialité</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.outline} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.85} onPress={() => setShowLogout(true)}>
          <MaterialIcons name="logout" size={18} color={Colors.onErrorContainer} />
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* MODAL ÉDITION PROFIL */}
      <Modal transparent animationType="slide" visible={showEdit} onRequestClose={() => setShowEdit(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Modifier le profil</Text>
              <TouchableOpacity onPress={() => setShowEdit(false)} hitSlop={10}>
                <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
            <FormField label="Nom complet" icon="person" value={newName} onChangeText={setNewName} />
            <PrimaryButton label="Enregistrer" onPress={saveProfile} />
          </View>
        </View>
      </Modal>

      {/* MODAL FAQ */}
      <Modal transparent animationType="slide" visible={showFaq} onRequestClose={() => setShowFaq(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>FAQ & Tutoriels</Text>
              <TouchableOpacity onPress={() => setShowFaq(false)} hitSlop={10}>
                <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
            <Text style={styles.faqQ}>Comment saisir sans connexion ?</Text>
            <Text style={styles.faqA}>Vos saisies sont enregistrées localement puis synchronisées automatiquement au retour du réseau.</Text>
            <Text style={styles.faqQ}>Comment convertir mes œufs en cartons ?</Text>
            <Text style={styles.faqA}>L&apos;application convertit automatiquement : 30 œufs = 1 alvéole, 360 œufs = 1 carton.</Text>
            <Text style={styles.faqQ}>Qui peut voir mes données financières ?</Text>
            <Text style={styles.faqA}>Uniquement le propriétaire et les gestionnaires autorisés de votre ferme.</Text>
          </View>
        </View>
      </Modal>

      {/* MODAL DÉCONNEXION */}
      <Modal transparent animationType="fade" visible={showLogout} onRequestClose={() => setShowLogout(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <MaterialIcons name="logout" size={28} color={Colors.error} />
            <Text style={styles.modalTitle}>Se déconnecter ?</Text>
            <Text style={styles.faqA}>
              {pendingCount > 0
                ? `Vous avez ${pendingCount} élément${pendingCount > 1 ? 's' : ''} en attente de synchronisation. Ils seront conservés sur cet appareil.`
                : 'Vous pourrez vous reconnecter à tout moment.'}
            </Text>
            <TouchableOpacity style={styles.dangerBtn} onPress={handleLogout}>
              <Text style={styles.dangerBtnText}>Se déconnecter</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowLogout(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.containerPadding, paddingBottom: 40 },
  section: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.surfaceContainerHigh, padding: 16, marginBottom: 16, ...Shadow.sm },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: Colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.primary, fontWeight: '700', fontSize: 18 },
  profileName: { ...Typography.headlineMd, fontSize: 16, color: Colors.onBackground },
  profileEmail: { fontSize: 13, color: Colors.onSurfaceVariant, marginTop: 2 },
  outlineBtn: { height: Spacing.touchTargetMin, borderRadius: Radius.DEFAULT, borderWidth: 2, borderColor: Colors.secondary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  outlineBtnText: { color: Colors.secondary, fontWeight: '700', fontSize: 13 },
  fieldLabel: { fontWeight: '600', fontSize: 14, color: Colors.onSurface, marginBottom: 8 },
  segment: { flexDirection: 'row', backgroundColor: Colors.surfaceContainer, borderRadius: Radius.DEFAULT, padding: 4 },
  segmentBtn: { flex: 1, height: 44, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  segmentBtnActive: { backgroundColor: Colors.surfaceContainerLowest, ...Shadow.sm },
  segmentText: { color: Colors.onSurfaceVariant, fontWeight: '600', fontSize: 13 },
  segmentTextActive: { color: Colors.primary },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  toggleLabel: { flex: 1, fontSize: 14, color: Colors.onSurface },
  syncMeta: { color: Colors.onSurfaceVariant, fontSize: 13, marginBottom: 6 },
  pendingText: { fontSize: 12, fontWeight: '700', marginBottom: 10 },
  pendingTextWarning: { color: Colors.warning },
  pendingTextOk: { color: Colors.tertiary },
  primaryBtn: { height: Spacing.touchTargetMin, borderRadius: Radius.DEFAULT, backgroundColor: Colors.primaryContainer, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryBtnText: { color: Colors.onPrimary, fontWeight: '700', fontSize: 14 },
  helpCard: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.surfaceContainerHigh, marginBottom: 16, overflow: 'hidden', ...Shadow.sm },
  helpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, minHeight: 56, borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainerHigh },
  helpRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  helpText: { fontSize: 14, color: Colors.onSurface },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.surfaceVariant },
  logoutBtn: { height: Spacing.touchTargetMin, borderRadius: Radius.DEFAULT, backgroundColor: Colors.errorContainer, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logoutText: { color: Colors.onErrorContainer, fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.surfaceContainerLowest, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.containerPadding, paddingBottom: 40, gap: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { ...Typography.headlineMd, fontSize: 20, color: Colors.onSurface },
  faqQ: { fontWeight: '700', fontSize: 14, color: Colors.onSurface, marginTop: 8 },
  faqA: { fontSize: 13, color: Colors.onSurfaceVariant, lineHeight: 19 },
  dangerBtn: { backgroundColor: Colors.error, borderRadius: Radius.full, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  dangerBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn: { paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: Colors.onSurfaceVariant, fontWeight: '600' },
});