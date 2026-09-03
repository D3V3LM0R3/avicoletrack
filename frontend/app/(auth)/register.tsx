// app/(auth)/register.tsx
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Radius, Spacing, Typography, Shadow } from '@/constants/design-system';
import { SubScreenHeader } from '@/components/ui/SubScreenHeader';

export default function RegisterScreen() {
  return (
    <View style={styles.container}>
      <SubScreenHeader title="Créer un compte" onBack={() => router.back()} />
      <View style={styles.content}>
        <Text style={styles.subtitle}>
          Choisissez comment vous souhaitez rejoindre AvicoleTrack
        </Text>

        {/* Carte 1 : Propriétaire */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push('/(auth)/register-owner')}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainer}>
            <MaterialIcons name="business" size={32} color={Colors.primary} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Je suis propriétaire d&apos;une ferme</Text>
            <Text style={styles.cardDescription}>
              Créez votre entreprise et gérez vos fermes avicoles
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={Colors.onSurfaceVariant} />
        </TouchableOpacity>

        {/* Carte 2 : Invitation */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push('/(auth)/register-invitation')}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainer}>
            <MaterialIcons name="mail-outline" size={32} color={Colors.secondary} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>J&apos;ai reçu une invitation</Text>
            <Text style={styles.cardDescription}>
              Rejoignez une ferme existante avec un code d&apos;invitation
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={Colors.onSurfaceVariant} />
        </TouchableOpacity>

        <Text style={styles.footer}>
          Déjà un compte ?{' '}
          <Text style={styles.link} onPress={() => router.back()}>
            Se connecter
          </Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: {
    flex: 1,
    padding: Spacing.containerPadding,
    gap: Spacing.stackGap,
  },
  subtitle: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    ...Shadow.card,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    ...Typography.bodyMd,
    fontWeight: '600',
    color: Colors.onSurface,
    marginBottom: 4,
  },
  cardDescription: {
    ...Typography.bodyMd,
    fontSize: 14,
    color: Colors.onSurfaceVariant,
  },
  footer: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginTop: 24,
  },
  link: {
    color: Colors.primary,
    fontWeight: '700',
  },
});