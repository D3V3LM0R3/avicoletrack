// app/(tabs)/games.tsx
import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '@/constants/design-system';
import { ScreenShell } from '@/components/ui/ScreenShell';

interface MiniGame {
  id: string;
  name: string;
  description: string;
  icon: string;
  route: string;
}

const AVAILABLE_GAMES: MiniGame[] = [
  {
    id: 'chicken_crossing',
    name: 'Chicken Crossing',
    description: 'Guide your chicken across the road safely, avoiding traffic.',
    icon: 'flutter-dash',
    route: '/games/chicken',
  },
];

export default function GamesScreen() {
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // Refresh when tab gains focus
    }, [])
  );

  return (
    <ScreenShell activeTab="games">
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <MaterialIcons name="sports-esports" size={48} color={Colors.primary} />
          <Text style={styles.titleText}>Mini Games</Text>
          <Text style={styles.subtitleText}>Choose a game to play</Text>
        </View>

        <View style={styles.gamesGrid}>
          {AVAILABLE_GAMES.map((game) => (
            <TouchableOpacity
              key={game.id}
              style={styles.gameCard}
              onPress={() => {
                setLoading(true);
                router.push(game.route as any);
                setLoading(false);
              }}
              activeOpacity={0.8}
            >
              <View style={styles.gameIconContainer}>
                <MaterialIcons name={game.icon as any} size={48} color={Colors.primary} />
              </View>
              <Text style={styles.gameName}>{game.name}</Text>
              <Text style={styles.gameDescription}>{game.description}</Text>
              <View style={styles.playButton}>
                <MaterialIcons name="play-arrow" size={20} color={Colors.onPrimary} />
                <Text style={styles.playButtonText}>Play</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.containerPadding,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  titleText: {
    ...Typography.headlineLarge,
    color: Colors.onSurface,
  },
  subtitleText: {
    ...Typography.bodyLarge,
    color: Colors.onSurfaceVariant,
  },
  gamesGrid: {
    gap: Spacing.lg,
  },
  gameCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.outlineVariant,
    gap: Spacing.md,
  },
  gameIconContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.primaryContainer,
    borderRadius: Radius.md,
  },
  gameName: {
    ...Typography.titleLarge,
    color: Colors.onSurface,
  },
  gameDescription: {
    ...Typography.bodySmall,
    color: Colors.onSurfaceVariant,
    lineHeight: 20,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    marginTop: Spacing.sm,
  },
  playButtonText: {
    ...Typography.labelLarge,
    color: Colors.onPrimary,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
});
