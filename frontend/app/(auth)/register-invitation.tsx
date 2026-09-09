// app/(auth)/register-invitation.tsx
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { Href, router, useLocalSearchParams } from 'expo-router';
import { Colors, Radius, Spacing, Typography } from '@/constants/design-system';
import { SubScreenHeader } from '@/components/ui/SubScreenHeader';
import { FormField } from '@/components/ui/FormField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { register } from '@/lib/api';

export default function RegisterInvitationScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const linkedToken = typeof token === 'string' ? token : token?.[0] || '';
  const [invitationCode, setInvitationCode] = useState(linkedToken);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!invitationCode.trim()) newErrors.invitationCode = 'Le code d\'invitation est obligatoire.';
    else if (invitationCode.trim().length < 20) newErrors.invitationCode = 'Le code d\'invitation est invalide.';
    if (!name.trim()) newErrors.name = 'Le nom complet est obligatoire.';
    if (!email.trim()) newErrors.email = "L'adresse e-mail est obligatoire.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'E-mail invalide.';
    if (!password.trim()) newErrors.password = 'Le mot de passe est obligatoire.';
    else if (password.length < 8) newErrors.password = 'Le mot de passe doit contenir au moins 8 caractères.';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Les mots de passe ne correspondent pas.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;
    setIsLoading(true);
    try {
      await register({ name: name.trim(), email, password, invitation_token: invitationCode.trim() });
      router.replace(({ pathname: '/verify-pending', params: { email: email.trim().toLowerCase() } } as unknown) as Href);
      setIsLoading(false);
      return;
    } catch (error) {
      Alert.alert('Erreur', error instanceof Error ? error.message : "Impossible de créer le compte. Veuillez réessayer.");
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SubScreenHeader title="Rejoindre une ferme" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <FormField
          label="Code d'invitation"
          icon="vpn-key"
          placeholder="Entrez le code reçu"
          value={invitationCode}
          editable={!linkedToken}
          onChangeText={(t) => {
            setInvitationCode(t);
            if (errors.invitationCode) setErrors({ ...errors, invitationCode: '' });
          }}
          error={errors.invitationCode}
        />

        <FormField
          label="Nom complet"
          icon="person-outline"
          placeholder="Jean Dupont"
          value={name}
          onChangeText={(t) => { setName(t); if (errors.name) setErrors({ ...errors, name: '' }); }}
          error={errors.name}
        />

        <FormField
          label="Adresse e-mail"
          icon="mail-outline"
          placeholder="jean@ferme.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={(t) => { setEmail(t); if (errors.email) setErrors({ ...errors, email: '' }); }}
          error={errors.email}
        />

        <FormField
          label="Mot de passe"
          icon="lock-outline"
          placeholder="••••••••"
          isPassword
          value={password}
          onChangeText={(t) => { setPassword(t); if (errors.password) setErrors({ ...errors, password: '' }); }}
          error={errors.password}
        />

        <FormField
          label="Confirmer le mot de passe"
          icon="lock-outline"
          placeholder="••••••••"
          isPassword
          value={confirmPassword}
          onChangeText={(t) => { setConfirmPassword(t); if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' }); }}
          error={errors.confirmPassword}
        />

        <PrimaryButton
          label={isLoading ? 'Création en cours...' : 'Rejoindre la ferme'}
          onPress={handleRegister}
          loading={isLoading}
          disabled={isLoading}
          style={{ marginTop: 8 }}
        />

        <Text style={styles.footer}>
          Déjà un compte ?{' '}
          <Text style={styles.link} onPress={() => router.back()}>
            Se connecter
          </Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.containerPadding, gap: Spacing.stackGap },
  invitationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: Radius.md,
    gap: 8,
  },
  valid: { backgroundColor: Colors.primaryContainer },
  invalid: { backgroundColor: Colors.errorContainer },
  badgeText: { ...Typography.labelLg },
  validText: { color: Colors.onPrimaryContainer },
  invalidText: { color: Colors.onErrorContainer },
  infoCard: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: Radius.md,
    padding: 16,
    gap: 8,
  },
  infoTitle: { ...Typography.bodyMd, fontWeight: '600', color: Colors.onSurface },
  infoText: { ...Typography.bodyMd, fontSize: 14, color: Colors.onSurfaceVariant },
  link: { color: Colors.primary, fontWeight: '700' },
  footer: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 16,
  },
});