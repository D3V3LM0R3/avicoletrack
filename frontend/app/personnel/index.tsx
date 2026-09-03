// app/personnel/index.tsx
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Share, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/design-system';
import { SubScreenHeader } from '@/components/ui/SubScreenHeader';
import { FormField } from '@/components/ui/FormField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { createInvitation, listFarmInvitations, listFarmMembers, listFarms, setMemberActive, updateMember, updateMemberPermissions, type Farm } from '@/lib/api';

interface Member { membershipId: number; id: number; initials: string; name: string; email: string; role: 'Gestionnaire' | 'Éleveur'; farmId: number; farmName: string; active: boolean; permissions: Record<string, boolean>; }
type InviteStatus = 'active' | 'expired' | 'used' | 'revoked';
interface Invitation { id: number; email: string; role: 'Gestionnaire' | 'Éleveur'; farm: string; status: InviteStatus; expiresAt: string; link?: string; }

const INITIAL_MEMBERS: Member[] = [];

const INITIAL_INVITES: Invitation[] = [];

const STATUS_CONFIG: Record<InviteStatus, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: Colors.tertiary, bg: 'rgba(58,123,57,0.15)' },
  expired: { label: 'Expirée', color: Colors.warning, bg: 'rgba(217,119,6,0.12)' },
  used: { label: 'Utilisée', color: Colors.slate, bg: Colors.surfaceContainerHigh },
  revoked: { label: 'Révoquée', color: Colors.error, bg: 'rgba(186,26,26,0.1)' },
};

const EXPIRY_OPTIONS = [
  { key: '24h', label: '24 h', hours: 24 },
  { key: '72h', label: '72 h', hours: 72 },
  { key: '7j', label: '7 jours', hours: 168 },
];

const INVITATION_BASE_URL = (process.env.EXPO_PUBLIC_INVITATION_BASE_URL || 'https://avicoletrack.cm/register-invitation').replace(/\/+$/, '');
const makeLink = (token: string) => `${INVITATION_BASE_URL}?token=${encodeURIComponent(token)}`;

export default function PersonnelScreen() {
  const [tab, setTab] = useState<'members' | 'invites'>('members');
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState(INITIAL_MEMBERS);
  const [invitations, setInvitations] = useState(INITIAL_INVITES);

  const [menuMember, setMenuMember] = useState<Member | null>(null);
  const [menuInvite, setMenuInvite] = useState<Invitation | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [filterRole, setFilterRole] = useState<'tous' | 'Gestionnaire' | 'Éleveur'>('tous');
  const [filterStatus, setFilterStatus] = useState<'tous' | 'actifs' | 'inactifs'>('tous');

  // Création d'invitation
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'Gestionnaire' | 'Éleveur'>('Éleveur');
  const [inviteExpiry, setInviteExpiry] = useState('72h');
  const [inviteError, setInviteError] = useState('');
  const [saving, setSaving] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(null);
  const [memberRole, setMemberRole] = useState<'Gestionnaire' | 'Éleveur'>('Éleveur');
  const [memberFarmId, setMemberFarmId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    listFarms().then(async (items) => {
      setFarms(items);
      if (!items[0]) return;
      setSelectedFarmId(items[0].id);
      const farmData = await Promise.all(items.map(async (farm) => ({ farm, members: await listFarmMembers(farm.id), invitations: await listFarmInvitations(farm.id) })));
      setMembers(farmData.flatMap(({ farm, members: memberItems }) => memberItems.map((member) => ({ membershipId: member.membership_id ?? member.id, id: member.id, initials: member.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(), name: member.name, email: member.email, role: member.farm_role === 'MANAGER' ? 'Gestionnaire' : 'Éleveur', farmId: farm.id, farmName: farm.name, active: member.is_active, permissions: member.permissions || {} }))));
      setInvitations(farmData.flatMap(({ farm, invitations: invitationItems }) => invitationItems.map((invitation) => ({ id: invitation.id, email: invitation.invited_email, role: invitation.role === 'MANAGER' ? 'Gestionnaire' : 'Éleveur', farm: farm.name, status: invitation.is_active ? 'active' : invitation.used_at ? 'used' : 'revoked', expiresAt: new Date(invitation.expires_at).toLocaleDateString('fr-FR') }))));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  /* ----- Listes filtrées ----- */
  const q = search.trim().toLowerCase();
  const filteredMembers = members.filter((m) => {
    const matchQ = !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
    const matchRole = filterRole === 'tous' || m.role === filterRole;
    const matchStatus = filterStatus === 'tous' || (filterStatus === 'actifs' ? m.active : !m.active);
    return matchQ && matchRole && matchStatus;
  });
  const filteredInvites = invitations.filter((i) => !q || i.email.toLowerCase().includes(q));

  /* ----- Actions membres (PATCH memberships) ----- */
  const toggleMember = (m: Member) => {
    Alert.alert(
      m.active ? 'Désactiver ce membre ?' : 'Réactiver ce membre ?',
      m.active ? `${m.name} perdra l'accès à la ferme.` : `${m.name} retrouvera l'accès à la ferme.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: async () => { try { await setMemberActive(m.membershipId, !m.active); const active = !m.active; setMembers((p) => p.map((x) => (x.membershipId === m.membershipId ? { ...x, active } : x))); setMenuMember((x) => x?.membershipId === m.membershipId ? { ...x, active } : x); } catch (error) { Alert.alert('Erreur', error instanceof Error ? error.message : 'Action impossible.'); } } },
      ]
    );
  };

  const togglePermission = async (member: Member, permission: string) => {
    const nextPermissions = { ...member.permissions, [permission]: !member.permissions[permission] };
    setMembers((items) => items.map((item) => item.membershipId === member.membershipId ? { ...item, permissions: nextPermissions } : item));
    setMenuMember((item) => item?.membershipId === member.membershipId ? { ...item, permissions: nextPermissions } : item);
    try {
      await updateMemberPermissions(member.membershipId, nextPermissions);
    } catch (error) {
      setMembers((items) => items.map((item) => item.membershipId === member.membershipId ? { ...item, permissions: member.permissions } : item));
      setMenuMember((item) => item?.membershipId === member.membershipId ? { ...item, permissions: member.permissions } : item);
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Impossible de modifier les permissions.');
    }
  };

  const openMemberMenu = (member: Member) => {
    setMemberRole(member.role);
    setMemberFarmId(member.farmId);
    setMenuMember(member);
  };

  const saveMemberAssignment = async () => {
    if (!menuMember || memberFarmId === null) return;
    const role = memberRole === 'Gestionnaire' ? 'MANAGER' : 'WORKER';
    try {
      await updateMember(menuMember.membershipId, { farm_id: memberFarmId, role });
      const farmName = farms.find((farm) => farm.id === memberFarmId)?.name || menuMember.farmName;
      const updated = { ...menuMember, role: memberRole, farmId: memberFarmId, farmName };
      setMembers((items) => items.map((item) => item.id === menuMember.id ? updated : item));
      setMenuMember(updated);
      Alert.alert('Succès', 'Le rôle et l’affectation ont été mis à jour.');
    } catch (error) {
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Impossible de modifier ce membre.');
    }
  };

  /* ----- Actions invitations ----- */
  const revokeInvite = (i: Invitation) => {
    Alert.alert('Révoquer cette invitation ?', `${i.email} ne pourra plus utiliser ce lien.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Révoquer', onPress: () => setInvitations((p) => p.map((x) => (x.id === i.id ? { ...x, status: 'revoked' } : x))) },
    ]);
  };

  const reactivateInvite = (i: Invitation) => {
    setInvitations((p) => p.map((x) => (x.id === i.id ? { ...x, status: 'active' } : x)));
    Alert.alert('Succès', 'Invitation réactivée.');
  };

  const copyLink = async (link: string) => {
    await Clipboard.setStringAsync(link);
    Alert.alert('Lien copié', 'Le lien d\'invitation a été copié dans le presse-papiers.');
  };

  const shareLink = async (link: string) => {
    try {
      await Share.share({ message: `Rejoignez AvicoleTrack en utilisant ce lien : ${link}` });
    } catch {}
  };

  /* ----- Création d'invitation (POST /personnel/invitations) ----- */
  const handleCreateInvite = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      setInviteError('Veuillez saisir une adresse e-mail valide.');
      return;
    }
    if (selectedFarmId === null) {
      setInviteError('Sélectionnez une ferme.');
      return;
    }
    setSaving(true);
    const expiry = EXPIRY_OPTIONS.find((e) => e.key === inviteExpiry)!;
    try {
      const farm = farms.find((item) => item.id === selectedFarmId);
      if (!farm) throw new Error('Aucune ferme disponible.');
      const created = await createInvitation({ enterprise_id: farm.enterprise_id, farm_id: farm.id, email: inviteEmail.trim(), role: inviteRole === 'Gestionnaire' ? 'MANAGER' : 'WORKER', expires_in_hours: expiry.hours });
      const expiresAt = new Date(created.expires_at);
      const link = makeLink(created.invitation_token);
      setInvitations((p) => [{ id: created.id, email: created.invited_email, role: inviteRole, farm: farm.name, status: 'active', expiresAt: `${String(expiresAt.getDate()).padStart(2, '0')}/${String(expiresAt.getMonth() + 1).padStart(2, '0')}/${expiresAt.getFullYear()}`, link }, ...p]);
      setCreatedLink(link);
    } catch (error) {
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Impossible de créer l invitation.');
      setSaving(false);
      return;
    }
    setSaving(false);
    setShowInvite(false);
    setInviteEmail('');
    setInviteError('');
  };

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Gestion du Personnel" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Gérez les accès et les rôles de votre équipe agricole.</Text>

        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tab, tab === 'members' && styles.tabActive]} onPress={() => { setTab('members'); setSearch(''); }}>
            <Text style={[styles.tabText, tab === 'members' && styles.tabTextActive]}>Membres ({members.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === 'invites' && styles.tabActive]} onPress={() => { setTab('invites'); setSearch(''); }}>
            <Text style={[styles.tabText, tab === 'invites' && styles.tabTextActive]}>Invitations ({invitations.length})</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={Colors.primary} size="small" />
            <Text style={styles.loadingText}>Chargement du personnel…</Text>
          </View>
        ) : (
          <>
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <MaterialIcons name="search" size={18} color={Colors.outline} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={tab === 'members' ? 'Rechercher un membre...' : 'Rechercher un e-mail invité...'}
                  value={search}
                  onChangeText={setSearch}
                  placeholderTextColor={Colors.outline}
                />
              </View>
              {tab === 'members' && (
                <TouchableOpacity style={styles.filterBtn} activeOpacity={0.8} onPress={() => setShowFilter(true)}>
                  <MaterialIcons name="filter-list" size={18} color={Colors.onSurface} />
                  <Text style={styles.filterText}>Filtrer</Text>
                </TouchableOpacity>
              )}
            </View>

            {tab === 'members' && (
              filteredMembers.length === 0 ? (
                <View style={styles.empty}>
                  <MaterialIcons name="people-outline" size={44} color={Colors.outline} />
                  <Text style={styles.emptyTitle}>Aucun membre trouvé</Text>
                  <Text style={styles.emptyText}>Modifiez votre recherche ou vos filtres.</Text>
                </View>
              ) : (
                filteredMembers.map((m) => (
                  <TouchableOpacity key={m.membershipId} style={styles.card} activeOpacity={0.85} onPress={() => openMemberMenu(m)}>
                    <View style={styles.cardTop}>
                      <View style={styles.cardTopLeft}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>{m.initials}</Text>
                        </View>
                        <View>
                          <Text style={styles.memberName}>{m.name}</Text>
                          <Text style={styles.memberEmail}>{m.email} • {m.farmName}</Text>
                        </View>
                      </View>
                      <TouchableOpacity hitSlop={8} onPress={() => openMemberMenu(m)}>
                        <MaterialIcons name="more-vert" size={20} color={Colors.onSurfaceVariant} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.cardBottom}>
                      <View style={styles.roleRow}>
                        <MaterialIcons name={m.role === 'Gestionnaire' ? 'badge' : 'agriculture'} size={16} color={Colors.outline} />
                        <Text style={styles.roleText}>{m.role}</Text>
                      </View>
                      <View style={[styles.statusPill, { backgroundColor: m.active ? 'rgba(58,123,57,0.15)' : 'rgba(186,26,26,0.1)' }]}>
                        <View style={[styles.statusDot, { backgroundColor: m.active ? Colors.tertiary : Colors.error }]} />
                        <Text style={[styles.statusText, { color: m.active ? Colors.tertiary : Colors.error }]}>
                          {m.active ? 'Actif' : 'Inactif'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )
            )}

            {tab === 'invites' && (
              filteredInvites.length === 0 ? (
                <View style={styles.empty}>
                  <MaterialIcons name="mail-outline" size={44} color={Colors.outline} />
                  <Text style={styles.emptyTitle}>Aucune invitation</Text>
                  <Text style={styles.emptyText}>Invitez un membre avec le bouton ci-dessous.</Text>
                </View>
              ) : (
                filteredInvites.map((i) => {
                  const st = STATUS_CONFIG[i.status];
                  return (
                    <View key={i.id} style={styles.card}>
                      <View style={styles.cardTop}>
                        <View style={styles.cardTopLeft}>
                          <View style={styles.avatar}>
                            <MaterialIcons name="mail-outline" size={20} color={Colors.primary} />
                          </View>
                          <View>
                            <Text style={styles.memberName}>{i.email}</Text>
                            <Text style={styles.memberEmail}>{i.farm} • {i.role}</Text>
                          </View>
                        </View>
                        <TouchableOpacity hitSlop={8} onPress={() => setMenuInvite(i)}>
                          <MaterialIcons name="more-vert" size={20} color={Colors.onSurfaceVariant} />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.cardBottom}>
                        <Text style={styles.roleText}>Expire le {i.expiresAt}</Text>
                        <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                          <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )
            )}
          </>
        )}
      </ScrollView>

      {/* FAB INVITER */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => setShowInvite(true)}>
        <MaterialIcons name="person-add" size={20} color={Colors.onPrimaryContainer} />
        <Text style={styles.fabText}>Inviter</Text>
      </TouchableOpacity>

      {/* ---------- MODAL ACTIONS MEMBRE ---------- */}
      <Modal transparent animationType="fade" visible={!!menuMember} onRequestClose={() => setMenuMember(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {menuMember && (
              <>
                <Text style={styles.modalTitle}>{menuMember.name}</Text>
                <Text style={styles.filterLabel}>Rôle</Text>
                <View style={styles.chipRow}>
                  {(['Éleveur', 'Gestionnaire'] as const).map((role) => (
                    <TouchableOpacity key={role} style={[styles.chip, memberRole === role && styles.chipActive]} onPress={() => setMemberRole(role)}>
                      <Text style={[styles.chipText, memberRole === role && styles.chipTextActive]}>{role}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.filterLabel}>Ferme affectée</Text>
                <View style={styles.chipRow}>
                  {farms.map((farm) => (
                    <TouchableOpacity key={farm.id} style={[styles.chip, memberFarmId === farm.id && styles.chipActive]} onPress={() => setMemberFarmId(farm.id)}>
                      <Text style={[styles.chipText, memberFarmId === farm.id && styles.chipTextActive]}>{farm.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <PrimaryButton label="Enregistrer rôle et affectation" icon="save" onPress={saveMemberAssignment} />
                {(memberRole === 'Gestionnaire' || memberRole === 'Éleveur') && (
                  <View style={styles.permissionsBox}>
                    <Text style={styles.permissionsTitle}>Permissions</Text>
                    {([
                      ['create_flock', 'Créer une bande'],
                      ['create_event', 'Créer un événement'],
                      ['send_notification', 'Envoyer une notification'],
                      ['confirm_stock_movement', 'Confirmer les mouvements de stock'],
                    ] as const).map(([permission, label]) => (
                      <View key={permission} style={styles.permissionRow}>
                        <Text style={styles.actionText}>{label}</Text>
                        <Switch value={!!menuMember.permissions[permission]} onValueChange={() => togglePermission(menuMember, permission)} />
                      </View>
                    ))}
                  </View>
                )}
                <TouchableOpacity style={styles.actionRow} onPress={() => toggleMember(menuMember)}>
                  <MaterialIcons name={menuMember.active ? 'person-off' : 'person'} size={20} color={menuMember.active ? Colors.error : Colors.primary} />
                  <Text style={[styles.actionText, { color: menuMember.active ? Colors.error : Colors.primary }]}>
                    {menuMember.active ? 'Désactiver le membre' : 'Réactiver le membre'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMenuMember(null)} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Annuler</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ---------- MODAL ACTIONS INVITATION ---------- */}
      <Modal transparent animationType="fade" visible={!!menuInvite} onRequestClose={() => setMenuInvite(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {menuInvite && (
              <>
                <Text style={styles.modalTitle}>{menuInvite.email}</Text>
                <TouchableOpacity style={styles.actionRow} onPress={() => { if (menuInvite.link) void copyLink(menuInvite.link); else Alert.alert('Lien indisponible', 'Pour des raisons de sécurité, le token est affiché uniquement lors de la création de l’invitation.'); setMenuInvite(null); }}>
                  <MaterialIcons name="content-copy" size={20} color={Colors.onSurfaceVariant} />
                  <Text style={styles.actionText}>Copier le lien</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionRow} onPress={() => { if (menuInvite.link) void shareLink(menuInvite.link); else Alert.alert('Lien indisponible', 'Créez une nouvelle invitation pour générer un lien partageable.'); setMenuInvite(null); }}>
                  <MaterialIcons name="share" size={20} color={Colors.onSurfaceVariant} />
                  <Text style={styles.actionText}>Partager</Text>
                </TouchableOpacity>
                {menuInvite.status === 'active' && (
                  <TouchableOpacity style={styles.actionRow} onPress={() => { revokeInvite(menuInvite); setMenuInvite(null); }}>
                    <MaterialIcons name="block" size={20} color={Colors.error} />
                    <Text style={[styles.actionText, { color: Colors.error }]}>Révoquer</Text>
                  </TouchableOpacity>
                )}
                {menuInvite.status === 'revoked' && (
                  <TouchableOpacity style={styles.actionRow} onPress={() => { reactivateInvite(menuInvite); setMenuInvite(null); }}>
                    <MaterialIcons name="restart-alt" size={20} color={Colors.primary} />
                    <Text style={[styles.actionText, { color: Colors.primary }]}>Réactiver</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setMenuInvite(null)} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Annuler</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ---------- MODAL FILTRES ---------- */}
      <Modal transparent animationType="slide" visible={showFilter} onRequestClose={() => setShowFilter(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtres</Text>
              <TouchableOpacity onPress={() => setShowFilter(false)} hitSlop={10}>
                <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
            <Text style={styles.filterLabel}>Rôle</Text>
            <View style={styles.chipRow}>
              {(['tous', 'Gestionnaire', 'Éleveur'] as const).map((r) => (
                <TouchableOpacity key={r} style={[styles.chip, filterRole === r && styles.chipActive]} onPress={() => setFilterRole(r)}>
                  <Text style={[styles.chipText, filterRole === r && styles.chipTextActive]}>{r === 'tous' ? 'Tous' : r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.filterLabel}>Statut</Text>
            <View style={styles.chipRow}>
              {([['tous', 'Tous'], ['actifs', 'Actifs'], ['inactifs', 'Inactifs']] as const).map(([k, l]) => (
                <TouchableOpacity key={k} style={[styles.chip, filterStatus === k && styles.chipActive]} onPress={() => setFilterStatus(k)}>
                  <Text style={[styles.chipText, filterStatus === k && styles.chipTextActive]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <PrimaryButton label="Appliquer" onPress={() => setShowFilter(false)} style={{ marginTop: 8 }} />
          </View>
        </View>
      </Modal>

      {/* ---------- MODAL CRÉATION INVITATION ---------- */}
      <Modal transparent animationType="slide" visible={showInvite} onRequestClose={() => setShowInvite(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Inviter un membre</Text>
              <TouchableOpacity onPress={() => setShowInvite(false)} hitSlop={10}>
                <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <FormField label="Adresse e-mail" icon="mail-outline" placeholder="employe@ferme.cm" keyboardType="email-address" autoCapitalize="none" value={inviteEmail} onChangeText={(t) => { setInviteEmail(t); setInviteError(''); }} />
            {inviteError !== '' && <Text style={styles.errorText}>{inviteError}</Text>}

            <Text style={styles.filterLabel}>Rôle proposé</Text>
            <View style={styles.chipRow}>
              {(['Éleveur', 'Gestionnaire'] as const).map((r) => (
                <TouchableOpacity key={r} style={[styles.chip, inviteRole === r && styles.chipActive]} onPress={() => setInviteRole(r)}>
                  <Text style={[styles.chipText, inviteRole === r && styles.chipTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterLabel}>Ferme concernée</Text>
            <View style={styles.chipRow}>
              {farms.map((farm) => (
                <TouchableOpacity key={farm.id} style={[styles.chip, selectedFarmId === farm.id && styles.chipActive]} onPress={() => { setSelectedFarmId(farm.id); setInviteError(''); }}>
                  <Text style={[styles.chipText, selectedFarmId === farm.id && styles.chipTextActive]}>{farm.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterLabel}>Durée de validité</Text>
            <View style={styles.chipRow}>
              {EXPIRY_OPTIONS.map((e) => (
                <TouchableOpacity key={e.key} style={[styles.chip, inviteExpiry === e.key && styles.chipActive]} onPress={() => setInviteExpiry(e.key)}>
                  <Text style={[styles.chipText, inviteExpiry === e.key && styles.chipTextActive]}>{e.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <PrimaryButton label={saving ? 'Création...' : "Créer l'invitation"} icon={saving ? undefined : 'person-add'} onPress={handleCreateInvite} disabled={saving} style={{ marginTop: 8 }} />
          </View>
        </View>
      </Modal>

      {/* ---------- MODAL LIEN CRÉÉ ---------- */}
      <Modal transparent animationType="fade" visible={!!createdLink} onRequestClose={() => setCreatedLink(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <MaterialIcons name="check-circle" size={32} color={Colors.tertiary} />
            <Text style={styles.modalTitle}>Invitation créée</Text>
            <Text style={styles.linkBox} numberOfLines={2}>{createdLink}</Text>
            <PrimaryButton label="Partager" icon="share" onPress={() => { if (createdLink) shareLink(createdLink); }} />
            <TouchableOpacity style={styles.copyRow} onPress={() => { if (createdLink) copyLink(createdLink); }}>
              <MaterialIcons name="content-copy" size={16} color={Colors.primary} />
              <Text style={styles.copyText}>Copier le lien</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCreatedLink(null)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.containerPadding, paddingBottom: 100 },
  subtitle: { color: Colors.onSurfaceVariant, marginBottom: 16 },
  tabs: { flexDirection: 'row', backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.DEFAULT, padding: 4, marginBottom: 16 },
  tab: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm },
  tabActive: { backgroundColor: Colors.surfaceContainerLowest, ...Shadow.sm },
  tabText: { color: Colors.onSurfaceVariant, fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: Colors.primary },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: Spacing.touchTargetMin, borderRadius: Radius.DEFAULT, borderWidth: 1, borderColor: Colors.outlineVariant, backgroundColor: Colors.surfaceContainerLowest, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontSize: 14, color: Colors.onSurface },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: Spacing.touchTargetMin, paddingHorizontal: 14, borderWidth: 1.5, borderColor: Colors.outline, borderRadius: Radius.DEFAULT },
  filterText: { fontSize: 13, fontWeight: '600', color: Colors.onSurface },
  card: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.outlineVariant, padding: 16, marginBottom: 12, ...Shadow.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.primary, fontWeight: '700', fontSize: 15 },
  memberName: { fontWeight: '700', fontSize: 14, color: Colors.onSurface },
  memberEmail: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 2 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.surfaceVariant, paddingTop: 12 },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roleText: { color: Colors.onSurfaceVariant, fontSize: 13 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11.5, fontWeight: '700' },
  loadingBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  loadingText: { color: Colors.onSurfaceVariant, fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 50, gap: 8 },
  emptyTitle: { ...Typography.headlineMd, fontSize: 17, color: Colors.onSurface },
  emptyText: { fontSize: 13, color: Colors.onSurfaceVariant, textAlign: 'center' },
  fab: { position: 'absolute', right: 20, bottom: 24, height: 52, paddingHorizontal: 20, borderRadius: 18, backgroundColor: Colors.primaryContainer, flexDirection: 'row', alignItems: 'center', gap: 8, ...Shadow.lg },
  fabText: { color: Colors.onPrimaryContainer, fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.surfaceContainerLowest, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.containerPadding, paddingBottom: 40, gap: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { ...Typography.headlineMd, fontSize: 20, color: Colors.onSurface },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  actionText: { fontSize: 15, fontWeight: '600', color: Colors.onSurface },
  cancelBtn: { paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: Colors.onSurfaceVariant, fontWeight: '600' },
  permissionsBox: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.surfaceVariant, paddingVertical: 8, gap: 4 },
  permissionsTitle: { color: Colors.onSurfaceVariant, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  permissionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 42 },
  filterLabel: { ...Typography.labelLg, fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 4 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerHigh, borderWidth: 1, borderColor: Colors.outlineVariant },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { ...Typography.labelLg, fontSize: 12, color: Colors.onSurfaceVariant },
  chipTextActive: { color: Colors.onPrimary },
  errorText: { color: Colors.error, fontSize: 12, marginTop: -6, marginBottom: 6, marginLeft: 4 },
  linkBox: { backgroundColor: Colors.surfaceContainerLow, borderRadius: Radius.DEFAULT, borderWidth: 1, borderColor: Colors.outlineVariant, padding: 12, fontSize: 12, color: Colors.onSurfaceVariant },
  copyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  copyText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
});