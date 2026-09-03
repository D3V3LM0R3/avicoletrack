// app/(tabs)/chat.tsx
import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, TouchableOpacity, TextInput, Modal } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/design-system';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { api } from '@/lib/api';

type ConversationPreview = {
  id: number;
  name: string;
  description?: string;
  conversation_type: string;
  farm_id?: number;
  last_message?: {
    content: string;
    sender_name: string;
    created_at: string;
  };
  unread_count: number;
  updated_at: string;
  members: {
    id: number;
    user_name: string;
  }[];
};
type ChatContact = { id: number; name: string; email: string; role: string };

export default function ChatScreen() {
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newConvName, setNewConvName] = useState('');
  const [newConvType, setNewConvType] = useState<'DIRECT' | 'GROUP'>('GROUP');
  const [searchText, setSearchText] = useState('');
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const loadConversations = useCallback(async (showInitialLoading = false) => {
    try {
      if (showInitialLoading) setLoading(true);
      setError(null);
      const [response, contactsResponse] = await Promise.all([
        api.get('/chat/conversations'),
        api.get('/chat/contacts'),
      ]);
      setConversations(response.data);
      setContacts(contactsResponse.data);
    } catch {
      console.error('Error loading conversations');
      setError('Erreur lors du chargement des conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadConversations(true);
      const interval = setInterval(loadConversations, 30000);
      return () => clearInterval(interval);
    }, [loadConversations])
  );

  const handleCreateConversation = async () => {
    if (!newConvName.trim()) {
      setCreateError('Indiquez un nom pour la conversation.');
      return;
    }
    if (selectedMemberIds.length === 0) {
      setCreateError('Sélectionnez au moins un autre membre pour créer la conversation.');
      return;
    }
    setCreateError('');
    setCreating(true);

    try {
      await api.post('/chat/conversations', {
        name: newConvName.trim(),
        conversation_type: newConvType,
        member_ids: selectedMemberIds,
      });
      setNewConvName('');
      setSelectedMemberIds([]);
      setShowCreateModal(false);
      await loadConversations(false);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Erreur lors de la création de la conversation.');
    } finally {
      setCreating(false);
    }
  };

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.name.toLowerCase().includes(searchText.toLowerCase()) ||
      (conv.last_message?.content.toLowerCase().includes(searchText.toLowerCase()) ?? false)
  );

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}j`;
    return date.toLocaleDateString('fr-FR');
  };

  return (
    <ScreenShell activeTab="chat">
      <View style={styles.container}>
        {/* Header with search and create button */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>Messages</Text>
          <View style={styles.headerActions}>
            <View style={styles.searchBox}>
              <MaterialIcons name="search" size={20} color={Colors.onSurfaceVariant} />
              <TextInput
                style={styles.searchInput}
                placeholder="Chercher..."
                placeholderTextColor={Colors.onSurfaceVariant}
                value={searchText}
                onChangeText={setSearchText}
              />
            </View>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => setShowCreateModal(true)}
            >
              <MaterialIcons name="add" size={24} color={Colors.onPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {!loading && filteredConversations.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialIcons name="chat-bubble-outline" size={48} color={Colors.onSurfaceVariant} />
            <Text style={styles.emptyText}>Aucune conversation</Text>
            <Text style={styles.emptySubtext}>Créez une nouvelle conversation pour commencer</Text>
          </View>
        )}

        {!loading && filteredConversations.length > 0 && (
          <ScrollView style={styles.conversationsList} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void loadConversations(true)} tintColor={Colors.primary} colors={[Colors.primary]} />}>
            {filteredConversations.map((conversation) => (
              <TouchableOpacity
                key={conversation.id}
                style={styles.conversationItem}
                onPress={() => router.push(`/(tabs)/chat/${conversation.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.conversationContent}>
                  <View style={styles.conversationHeader}>
                    <Text style={styles.conversationName}>{conversation.name}</Text>
                    {conversation.unread_count > 0 && (
                      <View style={styles.badgeUnread}>
                        <Text style={styles.badgeText}>{conversation.unread_count}</Text>
                      </View>
                    )}
                  </View>

                  {conversation.last_message && (
                    <View style={styles.lastMessageSection}>
                      <Text style={styles.lastMessageAuthor}>
                        {conversation.last_message.sender_name}:
                      </Text>
                      <Text
                        style={[
                          styles.lastMessage,
                          conversation.unread_count > 0 && styles.lastMessageUnread,
                        ]}
                        numberOfLines={1}
                      >
                        {conversation.last_message.content}
                      </Text>
                    </View>
                  )}

                  <View style={styles.conversationFooter}>
                    <Text style={styles.memberCount}>
                      {conversation.members.length} membre{conversation.members.length > 1 ? 's' : ''}
                    </Text>
                    <Text style={styles.timestamp}>
                      {formatTime(conversation.last_message?.created_at || conversation.updated_at)}
                    </Text>
                  </View>
                </View>

                <MaterialIcons name="chevron-right" size={20} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Create Conversation Modal */}
        <Modal
          transparent
          animationType="slide"
          visible={showCreateModal}
          onRequestClose={() => setShowCreateModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Nouvelle conversation</Text>
                <TouchableOpacity onPress={() => { setShowCreateModal(false); setCreateError(''); }} hitSlop={10}>
                  <MaterialIcons name="close" size={22} color={Colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.label}>Type de conversation</Text>
                <View style={styles.typeSelector}>
                  {(['GROUP', 'DIRECT'] as const).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeOption,
                        newConvType === type && styles.typeOptionActive,
                      ]}
                      onPress={() => {
                        setNewConvType(type);
                        if (type === 'DIRECT' && selectedMemberIds.length > 1) setSelectedMemberIds(selectedMemberIds.slice(0, 1));
                        setCreateError('');
                      }}
                    >
                      <MaterialIcons
                        name={type === 'GROUP' ? 'group' : 'person'}
                        size={20}
                        color={
                          newConvType === type ? Colors.onPrimaryContainer : Colors.onSurfaceVariant
                        }
                      />
                      <Text
                        style={[
                          styles.typeOptionText,
                          newConvType === type && styles.typeOptionTextActive,
                        ]}
                      >
                        {type === 'GROUP' ? 'Groupe' : 'Direct'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Nom de la conversation</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Discussion ferme A"
                  placeholderTextColor={Colors.onSurfaceVariant}
                  value={newConvName}
                  onChangeText={setNewConvName}
                />

                <Text style={styles.label}>Membres</Text>
                <Text style={styles.memberHint}>{newConvType === 'DIRECT' ? 'Sélectionnez une seule personne.' : 'Sélectionnez les personnes qui peuvent participer.'}</Text>
                <View style={styles.contactsList}>
                  {contacts.length === 0 ? <View style={styles.contactsEmpty}><MaterialIcons name="group-off" size={24} color={Colors.onSurfaceVariant} /><Text style={styles.contactsEmptyText}>Aucun membre disponible pour le moment.</Text></View> : contacts.map((contact) => {
                    const selected = selectedMemberIds.includes(contact.id);
                    return (
                      <TouchableOpacity
                        key={contact.id}
                        style={[styles.contactRow, selected && styles.contactRowSelected]}
                        onPress={() => {
                          setCreateError('');
                          setSelectedMemberIds((ids) => {
                            if (selected) return ids.filter((id) => id !== contact.id);
                            if (newConvType === 'DIRECT') return [contact.id];
                            return [...ids, contact.id];
                          });
                        }}
                      >
                        <MaterialIcons name={selected ? 'check-box' : 'check-box-outline-blank'} size={20} color={Colors.primary} />
                        <View style={styles.contactCopy}><Text style={styles.contactName}>{contact.name}</Text><Text style={styles.contactMeta}>{contact.role} • {contact.email}</Text></View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {createError !== '' && <View style={styles.createError}><MaterialIcons name="error-outline" size={18} color={Colors.error} /><Text style={styles.createErrorText}>{createError}</Text></View>}

                <PrimaryButton
                  label={creating ? 'Création...' : 'Créer la conversation'}
                  onPress={handleCreateConversation}
                  loading={creating}
                  disabled={creating || !newConvName.trim() || selectedMemberIds.length === 0 || contacts.length < 2}
                  style={{ marginTop: Spacing.lg }}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerSection: {
    padding: Spacing.containerPadding,
    gap: Spacing.md,
  },
  title: {
    ...Typography.headlineMedium,
    color: Colors.onBackground,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    ...Typography.bodyMedium,
    color: Colors.onSurface,
  },
  memberHint: { ...Typography.bodySmall, color: Colors.onSurfaceVariant, marginTop: -Spacing.sm },
  contactsList: { gap: Spacing.sm },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.surfaceContainer },
  contactRowSelected: { backgroundColor: Colors.primaryContainer },
  contactCopy: { flex: 1, gap: 2 },
  contactName: { ...Typography.labelLarge, color: Colors.onSurface },
  contactMeta: { ...Typography.labelSmall, color: Colors.onSurfaceVariant },
  contactsEmpty: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, backgroundColor: Colors.surfaceContainer },
  contactsEmptyText: { ...Typography.bodySmall, color: Colors.onSurfaceVariant, flex: 1 },
  createError: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.errorContainer },
  createErrorText: { ...Typography.bodySmall, color: Colors.onErrorContainer, flex: 1 },
  createButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...Typography.bodyMedium,
    color: Colors.error,
    textAlign: 'center',
    marginVertical: Spacing.md,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  emptyText: {
    ...Typography.titleMedium,
    color: Colors.onSurface,
  },
  emptySubtext: {
    ...Typography.bodySmall,
    color: Colors.onSurfaceVariant,
  },
  conversationsList: {
    flex: 1,
    paddingHorizontal: Spacing.containerPadding,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadow.xs,
  },
  conversationContent: {
    flex: 1,
    gap: Spacing.sm,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  conversationName: {
    ...Typography.titleSmall,
    color: Colors.onSurface,
    flex: 1,
  },
  badgeUnread: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },
  badgeText: {
    ...Typography.labelSmall,
    color: Colors.onPrimary,
    fontWeight: '600',
  },
  lastMessageSection: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  lastMessageAuthor: {
    ...Typography.labelSmall,
    color: Colors.onSurfaceVariant,
  },
  lastMessage: {
    flex: 1,
    ...Typography.bodySmall,
    color: Colors.onSurfaceVariant,
  },
  lastMessageUnread: {
    color: Colors.onSurface,
    fontWeight: '500',
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberCount: {
    ...Typography.labelSmall,
    color: Colors.outline,
  },
  timestamp: {
    ...Typography.labelSmall,
    color: Colors.onSurfaceVariant,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '86%',
    width: '100%',
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 12,
  },
  modalHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: Colors.outlineVariant,
    alignSelf: 'center',
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.containerPadding,
  },
  modalTitle: {
    ...Typography.titleMedium,
    color: Colors.onSurface,
  },
  modalScroll: {
    maxHeight: '100%',
  },
  modalContent: {
    paddingHorizontal: Spacing.containerPadding,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
  label: {
    ...Typography.labelMedium,
    color: Colors.onSurface,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainer,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
  typeOptionActive: {
    backgroundColor: Colors.primaryContainer,
    borderColor: Colors.primary,
  },
  typeOptionText: {
    ...Typography.labelMedium,
    color: Colors.onSurfaceVariant,
  },
  typeOptionTextActive: {
    color: Colors.onPrimaryContainer,
  },
  input: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    ...Typography.bodyMedium,
    color: Colors.onSurface,
    borderWidth: 1,
    borderColor: Colors.outline,
  },
});
