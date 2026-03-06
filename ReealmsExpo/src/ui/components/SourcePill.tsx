import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette } from '../../core/theme';
import type { SourceOption } from '../../core/constants';

type SourcePillProps = {
  option: SourceOption;
  selected: boolean;
  onPress: () => void;
};

export function SourcePill({ option, selected, onPress }: SourcePillProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        selected ? styles.pillSelected : null,
        pressed ? styles.pillPressed : null,
      ]}
    >
      <View style={[styles.iconWrap, selected ? { backgroundColor: option.accent } : null]}>
        <Ionicons
          color={selected ? palette.background : palette.textSecondary}
          name={option.icon}
          size={16}
        />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.label, selected ? styles.labelSelected : null]}>{option.label}</Text>
        <Text numberOfLines={2} style={styles.blurb}>
          {option.blurb}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: 188,
    minHeight: 86,
    padding: 14,
    borderRadius: 22,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    flexDirection: 'row',
    gap: 12,
  },
  pillSelected: {
    backgroundColor: palette.surfaceRaised,
    borderColor: palette.borderStrong,
  },
  pillPressed: {
    opacity: 0.92,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: palette.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  label: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  labelSelected: {
    color: palette.textPrimary,
  },
  blurb: {
    color: palette.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
});
