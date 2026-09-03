// app/(auth)/register-owner.tsx
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing, Typography } from '@/constants/design-system';
import { SubScreenHeader } from '@/components/ui/SubScreenHeader';
import { FormField } from '@/components/ui/FormField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { listFarms, login, register } from '@/lib/api';
import { setAuthToken } from '@/lib/auth-storage';

export default function RegisterOwnerScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [enterpriseName, setEnterpriseName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) newErrors.name = 'Le nom complet est obligatoire.';
    if (!email.trim()) newErrors.email = "L'adresse e-mail est obligatoire.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'E-mail invalide.';
    if (!enterpriseName.trim()) newErrors.enterpriseName = "Le nom de l'entreprise est obligatoire.";
    if (!password.trim()) newErrors.password = 'Le mot de passe est obligatoire.';
    else if (password.length < 8) newErrors.password = 'Le mot de passe doit contenir au moins 8 caractères.';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Les mots de passe ne correspondent pas.';
    if (!acceptTerms) newErrors.terms = 'Vous devez accepter les conditions pour continuer.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      await register({ name: name.trim(), email, password, enterprise_name: enterpriseName.trim() });
      const result = await login(email.trim(), password);
      await setAuthToken(result.access_token);
      await AsyncStorage.setItem('user_data', JSON.stringify(result.user));

      if (result.user.role === 'OWNER') {
        const farms = await listFarms();
        if (farms.length === 0) {
          router.replace('/setup');
          return;
        }
        router.replace('/(tabs)');
      } else {
        router.replace('/(tabs)');
      }
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
      <SubScreenHeader title="Inscription propriétaire" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
          label="Nom de l'entreprise"
          icon="business"
          placeholder="Ferme Avicole du Cameroun"
          value={enterpriseName}
          onChangeText={(t) => { setEnterpriseName(t); if (errors.enterpriseName) setErrors({ ...errors, enterpriseName: '' }); }}
          error={errors.enterpriseName}
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

        <TouchableOpacity
          style={styles.termsContainer}
          onPress={() => setAcceptTerms((v) => !v)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, acceptTerms && styles.checkboxChecked]}>
            {acceptTerms && <MaterialIcons name="check" size={14} color={Colors.onPrimary} />}
          </View>
          <Text style={styles.termsText}>
            J&apos;accepte les{' '}
            <Text style={styles.link}>conditions d&apos;utilisation</Text> et la{' '}
            <Text style={styles.link}>politique de confidentialité</Text>
          </Text>
        </TouchableOpacity>
        {errors.terms && <Text style={styles.errorText}>{errors.terms}</Text>}

        <PrimaryButton
          label={isLoading ? 'Création en cours...' : 'Créer mon compte'}
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
  termsContainer: { marginTop: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  termsText: { ...Typography.bodyMd, fontSize: 14, color: Colors.onSurfaceVariant, flex: 1 },
  link: { color: Colors.primary, fontWeight: '700' },
  errorText: { color: Colors.error, fontSize: 12, marginTop: 4 },
  footer: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 16,
  },
});