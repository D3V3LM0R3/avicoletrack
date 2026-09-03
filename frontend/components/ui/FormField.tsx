import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '@/constants/design-system';

type Props = TextInputProps & {
  label: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  isPassword?: boolean;
  suffix?: string;
  error?: string;
};

export function FormField({ label, icon, isPassword, suffix, error, style, ...rest }: Props) {
  const [secure, setSecure] = useState(!!isPassword);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, error && styles.inputRowError]}>
        {icon && (
          <MaterialIcons
            name={icon}
            size={20}
            color={error ? Colors.error : Colors.outline}
            style={styles.icon}
          />
        )}
        <TextInput
          placeholderTextColor={Colors.outline}
          secureTextEntry={secure}
          style={[styles.input, style]}
          {...rest}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setSecure((s) => !s)} activeOpacity={0.7}>
            <MaterialIcons
              name={secure ? 'visibility' : 'visibility-off'}
              size={20}
              color={Colors.outline}
            />
          </TouchableOpacity>
        )}
        {suffix && <Text style={styles.suffix}>{suffix}</Text>}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.stackGap,
  },
  label: {
    ...Typography.labelLg,
    color: Colors.onSurface,
    marginBottom: 8,
  },
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
  inputRowError: {
    borderColor: Colors.error,
    borderWidth: 1.5,
  },
  errorText: {
    color: Colors.error,
    fontSize: 12.5,
    marginTop: 6,
  },
  icon: {
    marginRight: -2,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.onSurface,
    paddingVertical: 10,
  },
  suffix: {
    color: Colors.onSurfaceVariant,
    fontWeight: '600',
    fontSize: 13,
  },
});
