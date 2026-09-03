import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, Spacing, Typography } from '@/constants/design-system';

type Props = {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
};

export function SubScreenHeader({ title, onBack, right }: Props) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={onBack ?? (() => router.back())}
        style={styles.backBtn}
        hitSlop={10}
      >
        <MaterialIcons name="arrow-back" size={22} color={Colors.onSurface} />
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.containerPadding,
    height: Spacing.touchTargetMin,
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
    backgroundColor: Colors.surface,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, ...Typography.headlineMd, fontSize: 17, color: Colors.primary, marginLeft: 4 },
  right: { minWidth: 32, alignItems: 'flex-end' },
});
