import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View, FlatList } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '@/constants/design-system';

type Props = {
  label: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  value: string | null;
  placeholder?: string;
  options: string[];
  onChange: (value: string) => void;
};

export function SelectField({ label, icon, value, placeholder = 'Sélectionner...', options, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.inputRow}
        activeOpacity={0.7}
        onPress={() => setOpen(true)}
      >
        {icon && <MaterialIcons name={icon} size={20} color={Colors.outline} />}
        <Text style={[styles.value, !value && styles.placeholder]}>
          {value ?? placeholder}
        </Text>
        <MaterialIcons name="expand-more" size={20} color={Colors.outline} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.optionText}>{item}</Text>
                  {item === value && (
                    <MaterialIcons name="check" size={18} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.stackGap },
  label: { ...Typography.labelLg, color: Colors.onSurface, marginBottom: 8 },
  inputRow: {
    minHeight: Spacing.touchTargetMin,
    borderWidth: 1,
    borderColor: Colors.outline,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceBright,
    gap: 10,
  },
  value: { flex: 1, fontSize: 15, color: Colors.onSurface },
  placeholder: { color: Colors.outline },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Spacing.containerPadding,
    maxHeight: '60%',
  },
  sheetTitle: {
    ...Typography.headlineMd,
    fontSize: 18,
    marginBottom: 12,
    color: Colors.onSurface,
  },
  option: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceVariant,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionText: { fontSize: 15, color: Colors.onSurface },
});
