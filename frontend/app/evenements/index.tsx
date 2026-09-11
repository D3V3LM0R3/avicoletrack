import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { cancelEvent, confirmEvent, createEvent, deleteEvent, getCurrentUser, getFarmPermissionState, listEvents, listFarms, listFlocks, type Event, type Farm, type Flock, updateEvent } from '@/lib/api';
import { Colors, Radius, Spacing, Typography } from '@/constants/design-system';
import { SubScreenHeader } from '@/components/ui/SubScreenHeader';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { enqueueOfflineItem } from '@/lib/offline-sync';

type CurrentUser = { id?: number; name?: string; role?: string } | null;
type StatusFilter = 'all' | 'pending' | 'confirmed' | 'cancelled';

const EVENT_TYPE_LABELS: Record<string, string> = {
  vaccination: 'Vaccination',
  treatment: 'Traitement',
  reform: 'Réforme',
  breeding: 'Reproduction',
  inspection: 'Inspection',
  other: 'Autre',
};

const STATUS_META: Record<Exclude<StatusFilter, 'all'>, { label: string; tint: string; bg: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  pending: { label: 'En attente', tint: Colors.warning, bg: 'rgba(217,119,6,0.12)', icon: 'schedule' },
  confirmed: { label: 'Confirmé', tint: Colors.primary, bg: 'rgba(13,99,27,0.12)', icon: 'check-circle' },
  cancelled: { label: 'Annulé', tint: Colors.error, bg: 'rgba(186,26,26,0.12)', icon: 'cancel' },
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function EvenementsScreen() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [flocks, setFlocks] = useState<Flock[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('vaccination');
  const [eventDate, setEventDate] = useState(new Date(Date.now() + 86400000));
  const [reminderDate, setReminderDate] = useState<Date | null>(null);
  const [picker, setPicker] = useState<'event' | 'reminder' | null>(null);
  const [draftDate, setDraftDate] = useState('');
  const [draftTime, setDraftTime] = useState('');
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [selectedFlockId, setSelectedFlockId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [flashMessage, setFlashMessage] = useState('');
  const [farmPermissions, setFarmPermissions] = useState<Record<number, { create_event: boolean }>>({});

  useEffect(() => {
    if (!flashMessage) return;
    const timeout = setTimeout(() => setFlashMessage(''), 2800);
    return () => clearTimeout(timeout);
  }, [flashMessage]);
  const [canCreateEvent, setCanCreateEvent] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser>(null);
  const [confirmingEventId, setConfirmingEventId] = useState<number | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<'confirm' | 'cancel'>('confirm');
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [financialType, setFinancialType] = useState<'cost' | 'benefit' | undefined>();
  const [financialAmount, setFinancialAmount] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => setIsOnline(state.isConnected ?? true));
    return unsub;
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([listFarms(), listFlocks(), listEvents(), getCurrentUser()])
      .then(([farmItems, flockItems, eventItems, user]) => {
        setFarms(farmItems);
        setFlocks(flockItems);
        setEvents(eventItems);
        setCurrentUser(user as CurrentUser);
        if (farmItems[0]) setSelected([farmItems[0].id]);
        return Promise.all(farmItems.map(async (farm) => {
          const permissions = await getFarmPermissionState(farm.id);
          return [farm.id, { create_event: permissions.create_event }] as const;
        }));
      })
      .then((entries) => {
        setFarmPermissions(Object.fromEntries(entries ?? []));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const selectedFarms = selected.length ? selected : farms.map((farm) => farm.id);
    const hasAccess = selectedFarms.every((farmId) => {
      const permission = farmPermissions[farmId];
      return permission ? permission.create_event : false;
    });
    setCanCreateEvent(hasAccess || selectedFarms.length === 0);
  }, [selected, farms, farmPermissions]);

  const availableFlocks = selected.length === 1 ? flocks.filter((flock) => selected.includes(flock.farm_id) && !flock.archived) : [];
  const isFlockRequired = selected.length === 1;

  const toggleFarm = (id: number) => {
    setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
    setSelectedFlockId(null);
  };

  const openPicker = (target: 'event' | 'reminder') => {
    const current = target === 'event' ? eventDate : (reminderDate || new Date());
    setDraftDate(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`);
    setDraftTime(`${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`);
    setPicker(target);
  };

  const applyPicker = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draftDate) || !/^\d{2}:\d{2}$/.test(draftTime)) {
      Alert.alert('Date invalide', 'Utilisez le format AAAA-MM-JJ et HH:MM.');
      return;
    }
    const next = new Date(`${draftDate}T${draftTime}:00`);
    if (Number.isNaN(next.getTime())) {
      Alert.alert('Date invalide', 'Vérifiez la date et l\'heure saisies.');
      return;
    }
    if (picker === 'event') setEventDate(next); else setReminderDate(next);
    setPicker(null);
  };

  const resetForm = () => {
    setEditingEvent(null);
    setTitle('');
    setType('vaccination');
    setEventDate(new Date(Date.now() + 86400000));
    setReminderDate(null);
    setSelectedFlockId(null);
    setSaveError('');
    setShowCreate(false);
  };

  const startEdit = (event: Event) => {
    if (event.status !== 'pending') {
      Alert.alert('Événement verrouillé', 'Seuls les événements en attente peuvent être modifiés.');
      return;
    }
    setEditingEvent(event);
    setTitle(event.title);
    setType(event.type);
    setEventDate(new Date(event.event_date));
    setReminderDate(event.reminder_date ? new Date(event.reminder_date) : null);
    setSelected([event.farm_id]);
    setSelectedFlockId(event.flock_id ?? null);
    setSaveError('');
    setShowCreate(true);
  };

  const save = async () => {
    if (!title.trim() || !selected.length) {
      setSaveError('Choisissez une ferme et indiquez un titre.');
      return;
    }
    if (isFlockRequired && !selectedFlockId) {
      setSaveError('La sélection d\'une bande est obligatoire pour cet événement.');
      return;
    }
    if (eventDate.getTime() <= Date.now()) {
      setSaveError('La date de l\'événement doit être dans le futur.');
      return;
    }
    if (reminderDate && reminderDate.getTime() >= eventDate.getTime()) {
      setSaveError('Le rappel doit être avant l\'événement.');
      return;
    }
    setSaveError('');
    setSaving(true);
    try {
      if (editingEvent) {
        if (editingEvent.status !== 'pending') {
          throw new Error('Seuls les événements en attente peuvent être modifiés.');
        }
        const updated = await updateEvent(editingEvent.id, {
          title: title.trim(),
          type,
          flock_id: selectedFlockId,
          event_date: eventDate.toISOString(),
          reminder_date: reminderDate ? reminderDate.toISOString() : null,
        });
        setEvents((items) => items.map((item) => item.id === updated.id ? updated : item));
        setFlashMessage('Événement modifié avec succès.');
        resetForm();
        return;
      }

      const payload = {
        farm_ids: selected,
        flock_id: selectedFlockId,
        type,
        title: title.trim(),
        event_date: eventDate.toISOString(),
        reminder_date: reminderDate ? reminderDate.toISOString() : undefined,
        financial_type: financialType,
        financial_amount: financialAmount ? Number(financialAmount.replace(',', '.')) : undefined,
      };

      if (!isOnline) {
        await enqueueOfflineItem({
          type: 'event',
          createdAt: Date.now(),
          farm_ids: payload.farm_ids,
          flock_id: payload.flock_id,
          event_type: payload.type,
          title: payload.title,
          event_date: payload.event_date,
          description: null,
          reminder_date: payload.reminder_date ?? null,
          financial_type: payload.financial_type ?? null,
          financial_amount: payload.financial_amount ?? null,
        });
        resetForm();
        setFlashMessage('Événement enregistré localement.');
        Alert.alert('Mode hors-ligne', 'Événement enregistré localement. Il sera synchronisé au retour du réseau.', [{ text: 'OK' }]);
        return;
      }

      const created = await createEvent(payload);
      setEvents((items) => [...created, ...items]);
      setFlashMessage('Événement créé pour les fermes sélectionnées.');
      resetForm();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible d\'enregistrer l\'événement.';
      setSaveError(message);
      Alert.alert('Erreur', message);
    } finally {
      setSaving(false);
    }
  };

  const handleEventPress = (event: Event) => {
    if (event.status !== 'pending') {
      Alert.alert('État de l\'événement', `Cet événement est déjà ${STATUS_META[event.status as Exclude<StatusFilter, 'all'>].label.toLowerCase()}.`);
      return;
    }
    Alert.alert(
      'Valider l\'événement ?',
      `${event.title} est en attente. Voulez-vous le valider maintenant ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Valider', onPress: () => { setConfirmingAction('confirm'); setConfirmationMessage(''); setConfirmingEventId(event.id); } },
      ],
    );
  };

  const submitValidation = async (eventId: number) => {
    const message = confirmationMessage.trim();
    if (!message) {
      Alert.alert('Message requis', `Écrivez un message avant de ${confirmingAction === 'confirm' ? 'valider' : 'annuler'} l'événement.`);
      return;
    }
    try {
      const updated = confirmingAction === 'confirm' ? await confirmEvent(eventId, message) : await cancelEvent(eventId, message);
      setEvents((items) => items.map((item) => item.id === updated.id ? updated : item));
      setConfirmationMessage('');
      setConfirmingEventId(null);
      setFlashMessage(confirmingAction === 'confirm' ? 'Événement validé.' : 'Événement annulé.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de valider l\'événement.';
      setSaveError(message);
      Alert.alert('Erreur', message);
    }
  };

  const handleCancelEvent = async (event: Event) => {
    if (event.status !== 'pending') {
      Alert.alert('Erreur', 'Seuls les événements en attente peuvent être annulés.');
      return;
    }
    setConfirmingAction('cancel');
    setConfirmationMessage('');
    setConfirmingEventId(event.id);
  };

  const handleDeleteEvent = async (event: Event) => {
    if (currentUser?.role !== 'OWNER') {
      Alert.alert('Accès refusé', 'Seul le propriétaire peut supprimer un événement.');
      return;
    }
    if (event.status === 'confirmed') {
      Alert.alert('Erreur', 'Un événement confirmé ne peut pas être supprimé.');
      return;
    }

    Alert.alert(
      'Supprimer l\'événement ?',
      `${event.title} sera supprimé définitivement.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEvent(event.id);
              setEvents((items) => items.filter((item) => item.id !== event.id));
              setFlashMessage('Événement supprimé.');
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Impossible de supprimer l\'événement.';
              setSaveError(message);
              Alert.alert('Erreur', message);
            }
          },
        },
      ],
    );
  };

  const groupedEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = events.filter((event) => {
      const farmName = farms.find((farm) => farm.id === event.farm_id)?.name ?? '';
      const flockName = flocks.find((flock) => flock.id === event.flock_id)?.name ?? '';
      const matchesText = !query || [event.title, farmName, flockName, EVENT_TYPE_LABELS[event.type] ?? event.type].join(' ').toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || event.status === statusFilter;
      return matchesText && matchesStatus;
    });

    const byStatus: Record<StatusFilter, Event[]> = { all: filtered, pending: [], confirmed: [], cancelled: [] };
    filtered.forEach((event) => {
      if (event.status === 'pending' || event.status === 'confirmed' || event.status === 'cancelled') {
        byStatus[event.status].push(event);
      }
    });
    return byStatus;
  }, [events, farms, flocks, search, statusFilter]);

  return (
    <View style={styles.container}>
      <SubScreenHeader title="Événements" onBack={() => router.back()} />

      <View style={styles.searchBox}>
        <MaterialIcons name="search" size={20} color={Colors.onSurfaceVariant} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un événement, ferme ou bande"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusFilters}>
        {(['all', 'pending', 'confirmed', 'cancelled'] as StatusFilter[]).map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
            onPress={() => setStatusFilter(status)}
          >
            <Text style={[styles.filterChipText, statusFilter === status && styles.filterChipTextActive]}>
              {status === 'all' ? 'Tous' : STATUS_META[status].label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {flashMessage !== '' && (
        <View style={styles.flashBanner}>
          <MaterialIcons name="check-circle" size={18} color={Colors.primary} />
          <Text style={styles.flashText}>{flashMessage}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>Événements</Text>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={Colors.primary} size="small" />
            <Text style={styles.loadingText}>Chargement des événements…</Text>
          </View>
        ) : statusFilter === 'all' ? (
          (['pending', 'confirmed', 'cancelled'] as Exclude<StatusFilter, 'all'>[]).map((status) => {
            const items = groupedEvents[status];
            if (!items.length) return null;
            return (
              <View key={status} style={styles.groupBlock}>
                <View style={[styles.sectionHeader, { backgroundColor: STATUS_META[status].bg }]}>
                  <MaterialIcons name={STATUS_META[status].icon} size={18} color={STATUS_META[status].tint} />
                  <Text style={[styles.sectionHeaderText, { color: STATUS_META[status].tint }]}>{STATUS_META[status].label}</Text>
                </View>
                {items.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    farms={farms}
                    flocks={flocks}
                    currentUser={currentUser}
                    onPress={() => handleEventPress(event)}
                    onModify={() => startEdit(event)}
                    onCancel={() => handleCancelEvent(event)}
                    onDelete={() => handleDeleteEvent(event)}
                    onValidate={() => {
                      setConfirmingAction('confirm');
                      setConfirmationMessage('');
                      setConfirmingEventId(event.id);
                    }}
                  />
                ))}
              </View>
            );
          })
        ) : (
          groupedEvents[statusFilter].length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Aucun événement dans cette catégorie</Text>
            </View>
          ) : groupedEvents[statusFilter].map((event) => (
            <EventCard
              key={event.id}
              event={event}
              farms={farms}
              flocks={flocks}
              currentUser={currentUser}
              onPress={() => handleEventPress(event)}
              onModify={() => startEdit(event)}
              onCancel={() => handleCancelEvent(event)}
              onDelete={() => handleDeleteEvent(event)}
              onValidate={() => {
                setConfirmingAction('confirm');
                setConfirmationMessage('');
                setConfirmingEventId(event.id);
              }}
            />
          ))
        )}
      </ScrollView>

      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlayBottom}>
          <View style={styles.modalCardBottom}>
            <View style={styles.modalHeader}>
              <Text style={styles.sectionTitle}>{editingEvent ? 'Modifier l\'événement' : 'Nouvel événement'}</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)} hitSlop={10}>
                <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Ferme(s) concernée(s)</Text>
            <View style={styles.farmList}>
              {farms.map((farm) => (
                <TouchableOpacity
                  key={farm.id}
                  style={[styles.farm, selected.includes(farm.id) && styles.farmSelected]}
                  onPress={() => toggleFarm(farm.id)}
                >
                  <MaterialIcons name={selected.includes(farm.id) ? 'check-box' : 'check-box-outline-blank'} size={20} color={Colors.primary} />
                  <Text style={styles.farmText}>{farm.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput style={styles.input} placeholder="Titre (ex. Vaccination Newcastle)" value={title} onChangeText={setTitle} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
              {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                <TouchableOpacity key={value} style={[styles.chip, type === value && styles.chipActive]} onPress={() => setType(value)}>
                  <Text style={type === value ? styles.chipTextActive : styles.chipText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {availableFlocks.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>{isFlockRequired ? 'Bande concernée *' : 'Bande concernée (optionnel)'}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
                  {availableFlocks.map((flock) => (
                    <TouchableOpacity
                      key={flock.id}
                      style={[styles.chip, selectedFlockId === flock.id && styles.chipActive]}
                      onPress={() => setSelectedFlockId(selectedFlockId === flock.id ? null : flock.id)}
                    >
                      <Text style={selectedFlockId === flock.id ? styles.chipTextActive : styles.chipText}>{flock.name || `Bande ${flock.id}`}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            <TouchableOpacity style={styles.datePicker} onPress={() => openPicker('event')}>
              <MaterialIcons name="event" size={18} color={Colors.primary} />
              <Text style={styles.dateText}>{formatDateTime(eventDate.toISOString())}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.datePicker} onPress={() => openPicker('reminder')}>
              <MaterialIcons name="notifications-active" size={18} color={Colors.warning} />
              <Text style={styles.dateText}>{reminderDate ? formatDateTime(reminderDate.toISOString()) : 'Ajouter un rappel (optionnel)'}</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Impact financier (optionnel)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
              {([['cost', 'Coût'], ['benefit', 'Bénéfice']] as const).map(([value, label]) => <TouchableOpacity key={value} style={[styles.chip, financialType === value && styles.chipActive]} onPress={() => setFinancialType(financialType === value ? undefined : value)}><Text style={financialType === value ? styles.chipTextActive : styles.chipText}>{label}</Text></TouchableOpacity>)}
            </ScrollView>
            {financialType && <TextInput style={styles.input} placeholder="Montant en FCFA" keyboardType="decimal-pad" value={financialAmount} onChangeText={setFinancialAmount} />}

            {canCreateEvent ? (
              <PrimaryButton label={saving ? 'Enregistrement...' : editingEvent ? 'Enregistrer les modifications' : 'Créer événement'} onPress={save} disabled={saving} />
            ) : (
              <Text style={styles.hintText}>Vous n&apos;avez pas la permission de créer un événement pour cette ferme.</Text>
            )}
            {saveError !== '' && <Text style={styles.errorText}>{saveError}</Text>}
          </View>
        </View>
      </Modal>

      <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>{picker === 'reminder' ? 'Régler le rappel' : 'Régler la date de l\'événement'}</Text>
            <Text style={styles.modalLabel}>Date (AAAA-MM-JJ)</Text>
            <TextInput style={styles.input} value={draftDate} onChangeText={setDraftDate} placeholder="2026-08-30" keyboardType="numbers-and-punctuation" />
            <Text style={styles.modalLabel}>Heure (HH:MM)</Text>
            <TextInput style={styles.input} value={draftTime} onChangeText={setDraftTime} placeholder="08:30" keyboardType="numbers-and-punctuation" />
            <TouchableOpacity style={styles.primaryAction} onPress={applyPicker}>
              <Text style={styles.primaryActionText}>Valider</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPicker(null)}>
              <Text style={styles.secondaryActionText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={confirmingEventId !== null} transparent animationType="slide" onRequestClose={() => setConfirmingEventId(null)}>
        <View style={styles.modalOverlayBottom}>
          <View style={styles.modalCardBottom}>
            <Text style={styles.sectionTitle}>{confirmingAction === 'confirm' ? 'Valider l\'événement' : 'Annuler l\'événement'}</Text>
            <TextInput
              style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
              placeholder={confirmingAction === 'confirm' ? 'Message de validation obligatoire' : 'Motif d’annulation obligatoire'}
              value={confirmationMessage}
              onChangeText={setConfirmationMessage}
              multiline
              maxLength={500}
            />
            <PrimaryButton label={confirmingAction === 'confirm' ? 'Valider maintenant' : 'Annuler maintenant'} onPress={() => confirmingEventId !== null && submitValidation(confirmingEventId)} />
            <TouchableOpacity onPress={() => setConfirmingEventId(null)}>
              <Text style={styles.secondaryActionText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {canCreateEvent && (
        <TouchableOpacity style={styles.fab} activeOpacity={0.9} onPress={() => { setEditingEvent(null); setShowCreate(true); }}>
          <MaterialIcons name="add" size={28} color={Colors.onPrimaryContainer} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function EventCard({
  event,
  farms,
  flocks,
  currentUser,
  onPress,
  onModify,
  onCancel,
  onDelete,
  onValidate,
}: {
  event: Event;
  farms: Farm[];
  flocks: Flock[];
  currentUser: CurrentUser;
  onPress: () => void;
  onModify: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onValidate: () => void;
}) {
  const farmName = farms.find((farm) => farm.id === event.farm_id)?.name ?? 'Ferme';
  const flockName = flocks.find((flock) => flock.id === event.flock_id)?.name ?? (event.flock_id ? `Bande ${event.flock_id}` : 'Sans bande');
  const status = event.status as Exclude<StatusFilter, 'all'>;
  const canManage = currentUser?.role === 'OWNER' || currentUser?.role === 'MANAGER';
  const canDelete = currentUser?.role === 'OWNER';

  return (
    <TouchableOpacity key={event.id} style={[styles.eventCard, status === 'confirmed' && styles.eventCardConfirmed, status === 'cancelled' && styles.eventCardCancelled]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.eventHeader}>
        <Text style={styles.eventTitle}>{event.title}</Text>
        <View style={[styles.statusPill, { backgroundColor: STATUS_META[status].bg }]}> 
          <MaterialIcons name={STATUS_META[status].icon} size={12} color={STATUS_META[status].tint} />
          <Text style={[styles.statusPillText, { color: STATUS_META[status].tint }]}>{STATUS_META[status].label}</Text>
        </View>
      </View>

      <View style={styles.tagRow}>
        <View style={styles.tag}><Text style={styles.tagText}>{farmName}</Text></View>
        <View style={styles.tagSecondary}><Text style={styles.tagText}>{flockName}</Text></View>
        <View style={styles.tagSecondary}><Text style={styles.tagText}>{EVENT_TYPE_LABELS[event.type] ?? event.type}</Text></View>
      </View>

      <Text style={styles.eventMeta}>Date / heure: {formatDateTime(event.event_date)}</Text>
      <Text style={styles.eventMeta}>Créé le: {formatDateTime(event.created_at)}</Text>
      {event.reminder_date && <Text style={styles.eventMeta}>Rappel : {formatDateTime(event.reminder_date)}</Text>}
      {event.description && <Text style={styles.eventMeta}>Détails : {event.description}</Text>}
      {event.confirmation_message && <Text style={styles.confirmationText}>Confirmation : {event.confirmation_message}</Text>}

      {event.status === 'pending' && canManage && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.secondaryActionButton} onPress={onModify}>
            <Text style={styles.secondaryActionButtonText}>Modifier</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.warningActionButton} onPress={onCancel}>
            <Text style={styles.warningActionButtonText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryActionButton} onPress={onValidate}>
            <Text style={styles.primaryActionButtonText}>Valider</Text>
          </TouchableOpacity>
          {canDelete && <TouchableOpacity style={styles.deleteActionButton} onPress={onDelete}>
            <Text style={styles.deleteActionButtonText}>Supprimer</Text>
          </TouchableOpacity>}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.containerPadding, marginBottom: 8, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.DEFAULT, backgroundColor: Colors.surfaceContainerLowest },
  searchInput: { flex: 1, marginLeft: 8, color: Colors.onSurface },
  statusFilters: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.containerPadding, paddingTop: 6, paddingBottom: 10 },
  filterChip: { minWidth: 96, height: 36, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerHigh, borderWidth: 1, borderColor: Colors.outlineVariant, justifyContent: 'center', alignItems: 'center' },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { color: Colors.onSurfaceVariant, fontWeight: '700', fontSize: 12 },
  filterChipTextActive: { color: Colors.onPrimary },
  flashBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(13,99,27,0.08)', borderWidth: 1, borderColor: 'rgba(13,99,27,0.2)', borderRadius: Radius.DEFAULT, marginHorizontal: Spacing.containerPadding, padding: 10 },
  flashText: { color: Colors.primary, fontWeight: '700', fontSize: 12 },
  loadingBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  loadingText: { color: Colors.onSurfaceVariant, fontSize: 13, fontWeight: '600' },
  scroll: { padding: Spacing.containerPadding, gap: 14, paddingBottom: 80 },
  sectionTitle: { ...Typography.headlineMd, fontSize: 17, color: Colors.onSurface },
  farmList: { gap: 8 },
  farm: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.md, backgroundColor: Colors.surfaceContainerLowest },
  farmSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryContainer },
  farmText: { color: Colors.onSurface, fontWeight: '600' },
  input: { backgroundColor: Colors.surfaceContainerLowest, borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.md, padding: 13, color: Colors.onSurface },
  typeRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip: { minWidth: 100, height: 36, paddingHorizontal: 12, paddingVertical: 9, borderRadius: Radius.full, backgroundColor: Colors.surfaceContainerHigh, borderWidth: 1, borderColor: Colors.outlineVariant, justifyContent: 'center', alignItems: 'center' },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.onSurfaceVariant, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: Colors.onPrimary, fontWeight: '700', fontSize: 12 },
  datePicker: { backgroundColor: Colors.surfaceContainerLowest, borderWidth: 1, borderColor: Colors.outlineVariant, borderRadius: Radius.md, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateText: { color: Colors.onSurface, fontWeight: '600' },
  hintText: { color: Colors.onSurfaceVariant, fontSize: 13 },
  errorText: { color: Colors.error, fontWeight: '700', fontSize: 12 },
  groupBlock: { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start' },
  sectionHeaderText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  eventCard: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.md, padding: 14, borderLeftWidth: 3, borderLeftColor: Colors.primary, gap: 8 },
  eventCardConfirmed: { borderLeftColor: Colors.primary },
  eventCardCancelled: { borderLeftColor: Colors.error },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full },
  statusPillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  eventTitle: { flex: 1, fontWeight: '700', color: Colors.onSurface, fontSize: 15 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: Colors.primaryContainer, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full },
  tagSecondary: { backgroundColor: Colors.surfaceContainerHigh, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.full },
  tagText: { color: Colors.onPrimaryContainer, fontSize: 11, fontWeight: '700' },
  eventMeta: { color: Colors.onSurfaceVariant, fontSize: 12 },
  confirmationText: { color: Colors.primary, fontSize: 11, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  primaryActionButton: { flex: 1, backgroundColor: Colors.primary, paddingVertical: 10, borderRadius: Radius.DEFAULT, alignItems: 'center' },
  primaryActionButtonText: { color: Colors.onPrimary, fontWeight: '800', fontSize: 12 },
  secondaryActionButton: { flex: 1, backgroundColor: Colors.surfaceContainerHigh, paddingVertical: 10, borderRadius: Radius.DEFAULT, alignItems: 'center' },
  secondaryActionButtonText: { color: Colors.onSurface, fontWeight: '800', fontSize: 12 },
  warningActionButton: { flex: 1, backgroundColor: 'rgba(186,26,26,0.10)', paddingVertical: 10, borderRadius: Radius.DEFAULT, alignItems: 'center' },
  warningActionButtonText: { color: Colors.error, fontWeight: '800', fontSize: 12 },
  deleteActionButton: { flexBasis: '100%', backgroundColor: 'rgba(186,26,26,0.08)', paddingVertical: 10, borderRadius: Radius.DEFAULT, alignItems: 'center' },
  deleteActionButtonText: { color: Colors.error, fontWeight: '800', fontSize: 12 },
  emptyCard: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.md, padding: 18, borderWidth: 1, borderColor: Colors.outlineVariant },
  emptyTitle: { color: Colors.onSurfaceVariant, fontWeight: '700', textAlign: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'center', padding: Spacing.containerPadding, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalCard: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.lg, padding: Spacing.containerPadding, gap: 10 },
  modalLabel: { color: Colors.onSurfaceVariant, fontSize: 12, fontWeight: '700', marginTop: 4 },
  primaryAction: { alignItems: 'center', backgroundColor: Colors.primary, padding: 14, borderRadius: Radius.md, marginTop: 6 },
  primaryActionText: { color: Colors.onPrimary, fontWeight: '800' },
  secondaryActionText: { textAlign: 'center', color: Colors.primary, fontWeight: '700', padding: 8 },
  modalOverlayBottom: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCardBottom: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.containerPadding, gap: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6 },
});
