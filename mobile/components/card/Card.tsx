import React, { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';

type CardVariant = 'elevated' | 'outlined' | 'flat';
type CardPadding = 'sm' | 'md' | 'lg';

type Props = {
  children: ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  style?: ViewStyle;
  testID?: string;
};

export function Card({
  children,
  variant = 'elevated',
  padding = 'md',
  style,
  testID,
}: Props) {
  const { theme } = useTheme();

  const pad: Record<CardPadding, number> = {
    sm: theme.spacing[3], // 12
    md: theme.spacing[4], // 16
    lg: theme.spacing[6], // 24
  };

  const variantStyle = (() => {
    switch (variant) {
      case 'outlined':
        return {
          backgroundColor: theme.colours.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colours.border,
          shadowOpacity: 0,
          elevation: 0,
        } as const;

      case 'flat':
        return {
          backgroundColor: theme.colours.surface2,
          borderWidth: 0,
          shadowOpacity: 0,
          elevation: 0,
        } as const;

      case 'elevated':
      default:
        return {
          backgroundColor: theme.colours.surface,
          borderWidth: 0,
          // iOS shadow
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          // Android elevation
          elevation: 2,
        } as const;
    }
  })();

  return (
    <View
      testID={testID || 'card'}
      accessibilityLabel={testID || 'card'}
      style={[
        styles.base,
        {
          borderRadius: theme.radii.lg,
          padding: pad[padding],
        },
        variantStyle,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
  },
});
