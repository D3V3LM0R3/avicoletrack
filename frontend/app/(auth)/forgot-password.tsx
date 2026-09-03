// app/(auth)/forgot-password.tsx
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Radius, Spacing, Typography, Shadow } from '@/constants/design-system';
import { SubScreenHeader } from '@/components/ui/SubScreenHeader';
import { FormField } from '@/components/ui/FormField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { requestPasswordReset } from '@/lib/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) {
      setError("L'adresse e-mail est obligatoire.");
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setError('Veuillez saisir une adresse e-mail valide.');
      return;
    }

    setError(undefined);
    setIsLoading(true);
    try {
      await requestPasswordReset(email);
      setIsSent(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Impossible de demander la réinitialisation du mot de passe.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SubScreenHeader title="Mot de passe oublié" onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isSent ? (
          /* ---------- ÉTAT SUCCÈS ---------- */
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <MaterialIcons name="mark-email-read" size={40} color={Colors.onPrimaryFixed} />
            </View>
            <Text style={styles.successTitle}>Lien envoyé</Text>
            <Text style={styles.successText}>
              Si un compte existe avec l&apos;adresse{' '}
              <Text style={styles.successEmail}>{email}</Text>, un lien de
              réinitialisation vous a été envoyé.
            </Text>
            <PrimaryButton
              label="Retour à la connexion"
              icon="login"
              onPress={() => router.back()}
            />
            <TouchableOpacity onPress={() => setIsSent(false)} hitSlop={10}>
              <Text style={styles.resend}>Renvoyer le lien</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ---------- FORMULAIRE ---------- */
          <View style={styles.form}>
            <Text style={styles.text}>
              Saisissez votre adresse e-mail, nous vous enverrons un lien pour
              réinitialiser votre mot de passe.
            </Text>

            <FormField
              label="Adresse e-mail"
              icon="mail-outline"
              placeholder="gerant@ferme.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (error) setError(undefined);
              }}
              error={error}
            />

            <PrimaryButton
              label="Envoyer le lien"
              icon="send"
              onPress={handleSend}
              loading={isLoading}
              disabled={isLoading}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.containerPadding, paddingTop: 32 },
  form: { gap: 20 },
  text: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, marginBottom: 4 },
  successCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    padding: 24,
    alignItems: 'center',
    ...Shadow.card,
  },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: { ...Typography.headlineMd, fontSize: 22, color: Colors.onSurface, marginBottom: 8 },
  successText: {
    ...Typography.bodyMd,
    fontSize: 14,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 24,
  },
  successEmail: { fontWeight: '700', color: Colors.onSurface },
  resend: { ...Typography.labelLg, color: Colors.primary, marginTop: 16 },
});