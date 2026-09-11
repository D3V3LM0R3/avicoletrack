// app/(tabs)/chat/[id].tsx
import React, { useCallback, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Alert,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, Typography } from '@/constants/design-system';
import { api } from '@/lib/api';
import { getItem } from '@/lib/storage';

type Message = {
  id: number;
  sender_id: number;
  sender_name: string;
  content: string;
  message_type: string;
  read_at: string | null;
  created_at: string;
};

type ConversationDetail = {
  id: number;
  name: string;
  description?: string;
  conversation_type: string;
  members: {
    id: number;
    user_name: string;
  }[];
  messages: Message[];
};

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scrollViewRef = useRef<FlatList>(null);

  const loadConversation = useCallback(async (showLoadingIndicator = false) => {
    try {
      if (showLoadingIndicator) setLoading(true);
      setError(null);

      const userData = await getItem('user_data');
      if (userData) {
        setCurrentUserId(JSON.parse(userData).id);
      }

      const response = await api.get(`/chat/conversations/${id}`);
      setConversation(response.data);
    } catch {
      console.error('Error loading conversation');
      setError('Erreur lors du chargement de la conversation');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadConversation(true);
      const interval = setInterval(loadConversation, 5000);
      return () => clearInterval(interval);
    }, [loadConversation])
  );

  const handleSendMessage = async () => {
    if (!messageText.trim() || !id) return;

    const contentToSend = messageText.trim();
    setMessageText('');

    try {
      setSending(true);
      await api.post(`/chat/conversations/${id}/messages`, {
        content: contentToSend,
        message_type: 'TEXT',
      });
      await loadConversation();
    } catch {
      console.error('Error sending message');
      setMessageText(contentToSend);
      Alert.alert('Erreur lors de l\'envoi du message');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    try {
      await api.delete(`/chat/messages/${messageId}`);
      await loadConversation();
    } catch {
      Alert.alert('Erreur lors de la suppression du message');
    }
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const groupedMessages = conversation?.messages.reduce((acc, msg) => {
    const dateKey = formatDate(msg.created_at);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(msg);
    return acc;
  }, {} as Record<string, Message[]>) || {};

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{conversation?.name || 'Conversation'}</Text>
          {conversation && conversation.members.length > 0 && (
            <Text style={styles.headerSubtitle}>
              {conversation.members.length} membre{conversation.members.length > 1 ? 's' : ''}
            </Text>
          )}
        </View>
      </View>

      {/* Messages */}
      {loading && <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 20 }} />}

      {error && <Text style={styles.errorText}>{error}</Text>}

      {!loading && conversation && (
        <>
          {conversation.messages.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="chat-bubble-outline" size={48} color={Colors.onSurfaceVariant} />
              <Text style={styles.emptyText}>Aucun message</Text>
              <Text style={styles.emptySubtext}>Commencez la conversation</Text>
            </View>
          ) : (
            <FlatList
              ref={scrollViewRef}
              data={Object.entries(groupedMessages).flatMap(([date, msgs]) => [
                { type: 'date', date },
                ...msgs.map((msg) => ({ type: 'message', data: msg })),
              ])}
              keyExtractor={(item, index) =>
                item.type === 'date' ? `date-${item.date}` : `msg-${(item as any).data.id}`
              }
              renderItem={({ item }) => {
                if (item.type === 'date') {
                  return (
                    <View style={styles.dateContainer}>
                      <Text style={styles.dateText}>{(item as any).date}</Text>
                    </View>
                  );
                }

                const msg = (item as any).data as Message;
                const isOwn = msg.sender_id === currentUserId;

                return (
                  <View key={msg.id} style={[styles.messageRow, isOwn && styles.messageRowOwn]}>
                    {!isOwn && <View style={styles.messageSpacer} />}
                    <TouchableOpacity
                      style={[styles.messageBubble, isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther]}
                      onLongPress={() => {
                        if (isOwn) {
                          Alert.alert('Supprimer ce message ?', undefined, [
                            { text: 'Annuler', onPress: () => {} },
                            {
                              text: 'Supprimer',
                              onPress: () => handleDeleteMessage(msg.id),
                              style: 'destructive',
                            },
                          ]);
                        }
                      }}
                      delayLongPress={500}
                    >
                      {!isOwn && <Text style={styles.messageAuthor}>{msg.sender_name}</Text>}
                      <Text style={[styles.messageContent, isOwn ? styles.messageContentOwn : styles.messageContentOther]}>
                        {msg.content}
                      </Text>
                      <Text
                        style={[styles.messageTime, isOwn ? styles.messageTimeOwn : styles.messageTimeOther]}
                      >
                        {formatTime(msg.created_at)}
                      </Text>
                    </TouchableOpacity>
                    {isOwn && <View style={styles.messageSpacer} />}
                  </View>
                );
              }}
              scrollEnabled={true}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd()}
              style={styles.messagesList}
              contentContainerStyle={styles.messagesListContent}
            />
          )}
        </>
      )}

      {/* Message Input */}
      <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        <TextInput
          style={styles.messageInput}
          placeholder="Écrivez un message..."
          placeholderTextColor={Colors.onSurfaceVariant}
          value={messageText}
          onChangeText={setMessageText}
          multiline
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={!messageText.trim() || sending}
        >
          <MaterialIcons
            name={sending ? 'hourglass-empty' : 'send'}
            size={20}
            color={(!messageText.trim() || sending) ? Colors.onSurfaceVariant : Colors.onPrimary}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.containerPadding,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    gap: Spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.titleMedium,
    color: Colors.onSurface,
  },
  headerSubtitle: {
    ...Typography.labelSmall,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
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
  messagesList: {
    flex: 1,
  },
  messagesListContent: {
    paddingHorizontal: Spacing.containerPadding,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  dateContainer: {
    alignItems: 'center',
    marginVertical: Spacing.md,
  },
  dateText: {
    ...Typography.labelSmall,
    color: Colors.onSurfaceVariant,
    backgroundColor: Colors.surfaceContainer,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  messageRowOwn: {
    justifyContent: 'flex-end',
  },
  messageSpacer: {
    flex: 1,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    gap: Spacing.xs,
  },
  messageBubbleOwn: {
    backgroundColor: Colors.primary,
  },
  messageBubbleOther: {
    backgroundColor: Colors.surfaceContainerLowest,
  },
  messageAuthor: {
    ...Typography.labelSmall,
    color: Colors.onSurfaceVariant,
  },
  messageContent: {
    ...Typography.bodyMedium,
  },
  messageContentOwn: {
    color: Colors.onPrimary,
  },
  messageContentOther: {
    color: Colors.onSurface,
  },
  messageTime: {
    ...Typography.labelSmall,
  },
  messageTimeOwn: {
    color: Colors.inverseOnSurface,
  },
  messageTimeOther: {
    color: Colors.onSurfaceVariant,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.md,
    paddingHorizontal: Spacing.containerPadding,
    paddingTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.outlineVariant,
  },
  messageInput: {
    flex: 1,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    ...Typography.bodyMedium,
    color: Colors.onSurface,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.surfaceContainerHighest,
  },
});
