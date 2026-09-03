import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Shadow, Spacing, Typography } from '@/constants/design-system';
import { usePreferences } from '@/lib/app-preferences';

type Props = {
  icon: keyof typeof MaterialIcons.glyphMap;
  iconBg: string;
  iconColor: string;
  badgeText?: string;
  badgeBg?: string;
  badgeColor?: string;
  badgeIcon?: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
  unit?: string;
  valueColor?: string;
  helper?: string;
  style?: ViewStyle;
  onPress?: () => void;
};

export function StatCard({
  icon,
  iconBg,
  iconColor,
  badgeText,
  badgeBg = Colors.surfaceVariant,
  badgeColor = Colors.onSurfaceVariant,
  badgeIcon,
  label,
  value,
  unit,
  valueColor = Colors.onBackground,
  helper,
  style,
  onPress,
  }: Props) {
    usePreferences();
  const content = (
    <View style={[styles.card, { backgroundColor: Colors.surfaceContainerLowest }, style]}>
      <View style={styles.top}>
        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
          <MaterialIcons name={icon} size={20} color={iconColor} />
        </View>
        {badgeText ? (
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            {badgeIcon && (
              <MaterialIcons name={badgeIcon} size={12} color={badgeColor} />
            )}
            <Text style={[styles.badgeText, { color: badgeColor }]}>
              {badgeText}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.label, { color: Colors.onSurfaceVariant }]}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
          {unit ? <Text style={[styles.unit, { color: Colors.onSurfaceVariant }]}>{unit}</Text> : null}
      </View>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
  return onPress ? <TouchableOpacity activeOpacity={0.82} onPress={onPress}>{content}</TouchableOpacity> : content;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.md,
    padding: Spacing.gridGutter + 4,
    minHeight: 148,
    width: '100%',
    ...Shadow.card,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: Radius.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  label: {
    ...Typography.labelLg,
    fontSize: 11,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    minHeight: 28,
    flexWrap: 'wrap',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
  },
  unit: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
  },
  helper: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 4,
  },
});
