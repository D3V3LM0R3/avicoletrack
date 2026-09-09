import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, Radius, Spacing, Typography } from '@/constants/design-system';
import { FormField } from '@/components/ui/FormField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { resendVerificationEmail } from '@/lib/api';

export default function VerifyPendingScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const initialEmail = typeof params.email === 'string' ? params.email : params.email?.[0] || '';
  const [email, setEmail] = useState(initialEmail);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const resend = async () => {
    if (!email.trim()) {
      setError("L'adresse e-mail est obligatoire.");
      return;
    }
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
      await resendVerificationEmail(email);
      setMessage('Si ce compte existe et doit être vérifié, un nouveau lien a été envoyé. Consultez aussi vos courriers indésirables.');
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : "Impossible d'envoyer l'e-mail.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.iconCircle}>
          <MaterialIcons name="mark-email-unread" size={42} color={Colors.primary} />
        </View>
        <Text style={styles.title}>Vérifiez votre adresse e-mail</Text>
        <Text style={styles.description}>
          Votre compte est créé, mais vous devez confirmer votre adresse avant de vous connecter. Ouvrez le lien reçu par e-mail, puis revenez ici.
        </Text>

        <View style={styles.card}>
          <FormField
            label="Adresse e-mail"
            icon="mail-outline"
            placeholder="vous@exemple.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={(value) => { setEmail(value); setMessage(''); setError(''); }}
            error={error}
          />
          {message && <Text style={styles.success}>{message}</Text>}
          <PrimaryButton
            label={isLoading ? 'Envoi en cours...' : "Renvoyer l'e-mail"}
            icon={isLoading ? undefined : 'send'}
            onPress={resend}
            loading={isLoading}
            disabled={isLoading}
          />
        </View>

        <Text style={styles.backLink} onPress={() => router.replace('/(auth)/login')}>
          Retour à la connexion
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: Spacing.containerPadding, gap: 18 },
  iconCircle: { alignSelf: 'center', width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.headlineLg, color: Colors.onSurface, textAlign: 'center' },
  description: { ...Typography.bodyLg, color: Colors.onSurfaceVariant, textAlign: 'center', lineHeight: 24 },
  card: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.outlineVariant, padding: 20, gap: 12 },
  success: { ...Typography.bodyMd, color: Colors.onTertiaryFixed, lineHeight: 20 },
  backLink: { ...Typography.bodyMd, color: Colors.primary, fontWeight: '700', textAlign: 'center', marginTop: 6 },
});
