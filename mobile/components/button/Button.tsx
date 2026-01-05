import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '../text/Text';
import { Spinner } from '../spinner/Spinner';
import { useTheme } from '../../theme/useTheme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

type Props = {
  text: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  style?: ViewStyle;
  testID?: string;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const Button = ({
  text,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  style,
  testID,
}: Props) => {
  const { theme } = useTheme();

  const pressed = useSharedValue(0);
  const isDisabled = disabled || loading;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.02 }],
    opacity: 1 - pressed.value * 0.1,
  }));

  const heights: Record<ButtonSize, number> = {
    sm: theme.sizes.controlSm,
    md: theme.sizes.controlMd,
    lg: theme.sizes.controlLg,
  };

  const paddingsX: Record<ButtonSize, number> = {
    sm: theme.spacing[3],
    md: theme.spacing[4],
    lg: theme.spacing[5],
  };

  const paddingsY: Record<ButtonSize, number> = {
    sm: theme.spacing[2],
    md: theme.spacing[2],
    lg: theme.spacing[3],
  };

  const variantStyle = (() => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundcolours: theme.colours.surface2,
          bordercolours: theme.colours.border,
          borderWidth: StyleSheet.hairlineWidth,
          textcolours: theme.colours.text,
        };
      case 'ghost':
        return {
          backgroundcolours: 'transparent',
          bordercolours: 'transparent',
          borderWidth: 0,
          textcolours: theme.colours.primary,
        };
      case 'danger':
        return {
          backgroundcolours: theme.colours.danger,
          bordercolours: 'transparent',
          borderWidth: 0,
          textcolours: theme.colours.white,
        };
      case 'primary':
      default:
        return {
          backgroundcolours: theme.colours.primary,
          bordercolours: 'transparent',
          borderWidth: 0,
          textcolours: theme.colours.white,
        };
    }
  })();

  return (
    <AnimatedPressable
      testID={testID || 'button'}
      accessibilityLabel={testID || 'button'}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={[
        styles.buttonBase,
        animatedStyle,
        {
          height: heights[size],
          paddingHorizontal: paddingsX[size],
          paddingVertical: paddingsY[size],
          borderRadius: theme.components.controlRadius,
          backgroundcolours: variantStyle.backgroundcolours,
          bordercolours: variantStyle.bordercolours,
          borderWidth: variantStyle.borderWidth,
          minWidth: fullWidth ? undefined : 180,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: isDisabled ? 0.6 : 1,
        },
        style,
      ]}
      onPress={() => {
        if (!isDisabled) onPress();
      }}
      onPressIn={() => {
        if (isDisabled) return;
        pressed.value = withTiming(1, { duration: 120 });
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: 120 });
      }}
    >
      {loading ? (
        <Spinner />
      ) : (
        <Text variant="bodyStrong" style={{ color: variantStyle.textcolours }}>
          {text}
        </Text>
      )}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  buttonBase: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
});

export { Button };
