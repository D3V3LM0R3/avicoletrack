import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, Typography } from '@/constants/design-system';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { verifyEmail } from '@/lib/api';

export default function VerifyEmailScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const verificationToken = typeof token === 'string' ? token : token?.[0] || '';
  const [message, setMessage] = useState('Vérification en cours...');

  useEffect(() => {
    if (!verificationToken) {
      setMessage('Lien de vérification invalide.');
      return;
    }
    verifyEmail(verificationToken)
      .then(() => setMessage('Votre adresse e-mail est vérifiée.'))
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Ce lien a expiré.'));
  }, [verificationToken]);

  return (
    <View style={styles.container}>
      {message === 'Vérification en cours...' ? <ActivityIndicator color={Colors.primary} /> : <Text style={styles.message}>{message}</Text>}
      <PrimaryButton label="Retour à la connexion" onPress={() => router.replace('/(auth)/login')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', padding: 24, gap: 24 },
  message: { ...Typography.bodyLg, color: Colors.onSurface, textAlign: 'center' },
});