import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Typography } from '@/constants/design-system';
import { listFarms } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

type Props = {
  farmName?: string;
  synced?: boolean;
  onSyncPress?: () => void;
};

export function TopBar({
  farmName,
  synced = true,
  onSyncPress,
}: Props) {
  const [activeFarm, setActiveFarm] = useState('Aucune ferme active');
  const { t } = useI18n();
  useEffect(() => { if (!farmName) listFarms().then((farms) => setActiveFarm(farms[0]?.name || t('activeFarm'))).catch(() => {}); }, [farmName, t]);
  return (
    <View style={[styles.container, { backgroundColor: Colors.surface, borderBottomColor: Colors.outlineVariant }]}>
      <View style={styles.brand}>
        <MaterialIcons name="agriculture" size={22} color={Colors.primary} />
        <Text style={styles.brandText}>AvicoleTrack</Text>
      </View>

      <View style={styles.right}>
        <View style={styles.farmInfo}>
          <Text style={styles.farmName}>{farmName || activeFarm}</Text>
          <View style={styles.syncRow}>
            <MaterialIcons
              name="sync"
              size={12}
              color={synced ? Colors.primary : Colors.outline}
            />
            <Text style={[styles.syncText, { color: synced ? Colors.primary : Colors.outline }]}>
              {synced ? t('synced') : t('notSynced')}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={onSyncPress}
          style={styles.syncButton}
          activeOpacity={0.7}
        >
          <MaterialIcons name="sync" size={20} color={Colors.onSurface} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: Spacing.touchTargetMin,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerPadding,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandText: {
    ...Typography.headlineMd,
    fontSize: 17,
    color: Colors.primary,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  farmInfo: {
    alignItems: 'flex-end',
  },
  farmName: {
    ...Typography.labelLg,
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  syncText: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '600',
  },
  syncButton: {
    padding: 4,
    borderRadius: 20,
  },
});
