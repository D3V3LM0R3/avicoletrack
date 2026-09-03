// app/(auth)/onboarding.tsx
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Radius, Spacing, Typography } from '@/constants/design-system';
import { PrimaryButton } from '@/components/ui/PrimaryButton';

const SLIDES = [
  {
    icon: 'analytics' as const,
    iconColor: Colors.primary,
    title: 'Gestion Optimisée',
    text: "Suivez la production quotidienne, la consommation d'aliments et le poids de vos volailles avec précision.",
  },
  {
    icon: 'notifications-active' as const,
    iconColor: Colors.warning,
    title: 'Alertes Proactives',
    text: "Soyez averti des baisses de production ou des ruptures de stock avant qu'elles ne deviennent critiques.",
  },
  {
    icon: 'wifi-off' as const,
    iconColor: Colors.slate,
    title: 'Mode Hors-Ligne',
    text: 'Saisissez vos données directement dans les poulaillers. La synchronisation se fait automatiquement dès le retour réseau.',
  },
];

export default function OnboardingScreen() {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem('has_completed_onboarding', 'true');
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
    router.replace('/(auth)/login');
  };

  const handleNext = () => {
    if (isLast) {
      completeOnboarding();
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.skipRow}>
        {!isLast && (
          <TouchableOpacity onPress={completeOnboarding} hitSlop={10}>
            <Text style={styles.skip}>Passer</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.illustration}>
          <View style={styles.iconCircle}>
            <MaterialIcons name={slide.icon} size={64} color={slide.iconColor} />
          </View>
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.text}>{slide.text}</Text>
      </View>

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
        <PrimaryButton
          label={isLast ? 'Commencer' : 'Suivant'}
          onPress={handleNext}
          style={styles.button}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: Colors.background,
  },
  skipRow: {
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.containerPadding,
    paddingTop: 60,
    minHeight: 44,
  },
  skip: { 
    ...Typography.labelLg, 
    color: Colors.onSurfaceVariant,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.containerPadding,
  },
  illustration: {
    width: '100%',
    height: 280,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.surfaceContainerLowest,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  title: {
    ...Typography.headlineLg,
    fontSize: 28,
    fontWeight: '700',
    color: Colors.onSurface,
    textAlign: 'center',
    marginBottom: 16,
  },
  text: {
    ...Typography.bodyLg,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    maxWidth: 340,
  },
  bottom: {
    paddingHorizontal: Spacing.containerPadding,
    paddingBottom: 48,
    paddingTop: 24,
    gap: 24,
    alignItems: 'center',
  },
  dots: { 
    flexDirection: 'row', 
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.surfaceVariant,
  },
  dotActive: {
    width: 28,
    backgroundColor: Colors.primary,
  },
  button: {
    width: '100%',
  },
});