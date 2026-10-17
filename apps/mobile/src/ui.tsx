import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export const colors = {
  bg: '#0b1220',
  card: '#141d30',
  text: '#e8edf7',
  dim: '#8d9ab3',
  accent: '#4f8cff',
  good: '#3ecf8e',
  bad: '#ff6b6b',
};

export function Button({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export function Card({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'bad';
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text
        selectable
        style={[
          styles.value,
          tone === 'good' && { color: colors.good },
          tone === 'bad' && { color: colors.bad },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginVertical: 6,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginVertical: 8,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  row: { marginVertical: 4 },
  label: { color: colors.dim, fontSize: 12 },
  value: { color: colors.text, fontSize: 14, fontVariant: ['tabular-nums'] },
});
