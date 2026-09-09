// app/(auth)/login.tsx
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Href, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Radius, Spacing, Typography } from '@/constants/design-system';
import { FormField } from '@/components/ui/FormField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { listFarms, login } from '@/lib/api';
import { setAuthToken } from '@/lib/auth-storage';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim()) newErrors.email = "L'adresse e-mail est obligatoire.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "E-mail invalide.";
    if (!password.trim()) newErrors.password = "Le mot de passe est obligatoire.";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setServerError('');
    setIsLoading(true);
    try {
      const result = await login(email, password);
      await setAuthToken(result.access_token);
      await AsyncStorage.setItem('user_data', JSON.stringify(result.user));

      if (result.user.role === 'OWNER') {
        const farms = await listFarms();
        router.replace(farms.length === 0 ? '/setup' : '/(tabs)');
      } else {
        router.replace('/(tabs)');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Adresse e-mail ou mot de passe incorrect.';
      console.error('[auth] Login failed:', error);
      setServerError(message);
      if (message.toLowerCase().includes('verify') || message.toLowerCase().includes('confirme')) {
        router.replace(({ pathname: '/verify-pending', params: { email: email.trim().toLowerCase() } } as unknown) as Href);
      } else {
        Alert.alert('Connexion impossible', message);
      }
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.logo}>
            <MaterialIcons name="agriculture" size={34} color={Colors.primary} />
          </View>
          <Text style={styles.appName}>AvicoleTrack</Text>
          <Text style={styles.subtitle}>Gestion avicole professionnelle</Text>
        </View>

        <View style={styles.verificationNotice}>
          <MaterialIcons name="mark-email-unread" size={20} color={Colors.onPrimaryContainer} />
          <Text style={styles.verificationNoticeText}>
            Après votre inscription, confirmez votre adresse e-mail avec le lien reçu avant de vous connecter.
          </Text>
        </View>

        <View style={styles.card}>
          <FormField
            label="Adresse e-mail"
            icon="mail-outline"
            placeholder="gerant@ferme.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={(t) => { setEmail(t); if(errors.email) setErrors({...errors, email: undefined}); }}
          />
          {/* Affichage manuel de l'erreur */}
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

          <FormField
            label="Mot de passe"
            icon="lock-outline"
            placeholder="••••••••"
            isPassword
            value={password}
            onChangeText={(t) => { setPassword(t); if(errors.password) setErrors({...errors, password: undefined}); }}
          />
          {/* Affichage manuel de l'erreur */}
          {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          {serverError && <Text accessibilityRole="alert" style={styles.serverError}>{serverError}</Text>}

          <Text style={styles.forgot} onPress={() => router.push('/(auth)/forgot-password')}>
            Mot de passe oublié ?
          </Text>

          {/* Pas de children, on change juste le label */}
          <PrimaryButton
            label={isLoading ? 'Connexion...' : 'Se connecter'}
            icon={isLoading ? undefined : 'login'}
            onPress={handleLogin}
            disabled={isLoading}
            style={{ marginTop: 6 }}
          />
        </View>

        <Text style={styles.footer}>
          Pas encore de compte ?{' '}
          <Text style={styles.footerLink} onPress={() => router.push('/(auth)/register')}>
            Créer un compte
          </Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Spacing.containerPadding, paddingVertical: 40 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 80, height: 80, borderRadius: Radius.lg, backgroundColor: Colors.surfaceContainerHigh, borderWidth: 1, borderColor: Colors.outlineVariant, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  appName: { ...Typography.headlineLg, fontSize: 28, color: Colors.onSurface },
  subtitle: { ...Typography.bodyMd, color: Colors.onSurfaceVariant, marginTop: 6 },
  verificationNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Colors.primaryContainer, borderRadius: Radius.md, padding: 14, marginBottom: 16 },
  verificationNoticeText: { ...Typography.bodyMd, flex: 1, fontSize: 13, lineHeight: 18, color: Colors.onPrimaryContainer },
  card: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.outlineVariant, padding: 24 },
  forgot: { textAlign: 'right', color: Colors.primary, fontWeight: '700', fontSize: 13, marginBottom: 8, marginTop: -4 },
  footer: { textAlign: 'center', marginTop: 24, color: Colors.onSurfaceVariant },
  footerLink: { color: Colors.primary, fontWeight: '700' },
  errorText: { color: Colors.error, fontSize: 12, marginTop: -8, marginBottom: 12, marginLeft: 4 }, // Style pour l'erreur
  serverError: { color: Colors.error, fontSize: 13, lineHeight: 19, marginBottom: 12, textAlign: 'center' },
});