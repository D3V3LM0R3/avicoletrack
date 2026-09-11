import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, Typography } from '@/constants/design-system';
import { SubScreenHeader } from '@/components/ui/SubScreenHeader';
import { FormField } from '@/components/ui/FormField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { resetPassword } from '@/lib/api';

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const resetToken = typeof token === 'string' ? token : token?.[0] || '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const submit = async () => {
    if (password.length < 8 || password !== confirmation) {
      setFeedback('Utilisez au moins 8 caractères et saisissez le même mot de passe dans les deux champs.');
      return;
    }
    setFeedback(null);
    setLoading(true);
    try {
      await resetPassword(resetToken, password);
      setCompleted(true);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Ce lien a expiré.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SubScreenHeader title="Nouveau mot de passe" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.text}>Choisissez un nouveau mot de passe pour votre compte.</Text>
        {feedback && <Text style={styles.error}>{feedback}</Text>}
        {completed && <Text style={styles.success}>Mot de passe modifié. Vous pouvez maintenant vous connecter.</Text>}
        <FormField label="Nouveau mot de passe" icon="lock-outline" isPassword value={password} onChangeText={setPassword} />
        <FormField label="Confirmer le mot de passe" icon="lock-outline" isPassword value={confirmation} onChangeText={setConfirmation} />
        {completed ? (
          <PrimaryButton label="Se connecter" onPress={() => router.replace('/(auth)/login')} />
        ) : (
          <PrimaryButton label="Modifier le mot de passe" onPress={submit} loading={loading} disabled={loading || !resetToken} />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.containerPadding, gap: 20 },
  text: { ...Typography.bodyMd, color: Colors.onSurfaceVariant },
  error: { ...Typography.bodyMd, color: Colors.error },
  success: { ...Typography.bodyMd, color: Colors.primary },
});