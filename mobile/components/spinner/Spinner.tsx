import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../theme/useTheme';

type SpinnerSize = 'sm' | 'md' | 'lg';

type Props = {
  size?: SpinnerSize | number;
  color?: string;
  thickness?: number;
};

const Spinner = ({ size = 'md', color, thickness = 2 }: Props) => {
  const { theme } = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, {
        duration: 1000,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 360}deg` }],
  }));

  const resolvedSize =
    typeof size === 'number'
      ? size
      : {
          sm: theme.sizes.iconSm,
          md: theme.sizes.iconMd,
          lg: theme.sizes.iconLg,
        }[size];

  const resolvedColor = color ?? theme.colours.text;

  return (
    <Animated.View
      testID="spinner"
      accessibilityLabel="spinner"
      accessibilityRole="progressbar"
      style={[
        styles.loader,
        {
          width: resolvedSize,
          height: resolvedSize,
          borderRadius: resolvedSize / 2,
          borderWidth: thickness,
          borderColor: resolvedColor,
          borderBottomColor: 'transparent',
          opacity: 0.7,
        },
        animatedStyle,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  loader: {
    alignSelf: 'center',
  },
});

export { Spinner };
