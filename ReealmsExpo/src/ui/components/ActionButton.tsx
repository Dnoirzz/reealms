import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { palette } from '../../core/theme';

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: ActionButtonProps) {
  const tone = buttonVariants[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone.container,
        inactive ? styles.buttonDisabled : null,
        pressed && !inactive ? styles.buttonPressed : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone.spinner} size="small" />
      ) : (
        <Text style={[styles.label, tone.label]}>{label}</Text>
      )}
    </Pressable>
  );
}

const buttonVariants = {
  primary: {
    container: {
      backgroundColor: palette.accent,
      borderColor: palette.accentStrong,
    },
    label: {
      color: palette.background,
    },
    spinner: palette.background,
  },
  secondary: {
    container: {
      backgroundColor: palette.surfaceRaised,
      borderColor: palette.borderStrong,
    },
    label: {
      color: palette.textPrimary,
    },
    spinner: palette.textPrimary,
  },
  ghost: {
    container: {
      backgroundColor: 'transparent',
      borderColor: palette.border,
    },
    label: {
      color: palette.textSecondary,
    },
    spinner: palette.textSecondary,
  },
} as const;

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
});
