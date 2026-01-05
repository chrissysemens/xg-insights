import React from 'react';
import {
  Text as RNText,
  TextProps as RNTextProps,
  StyleProp,
  TextStyle,
} from 'react-native';
import { useTheme } from '../../theme/useTheme';
import type { TextVariant } from '../../theme/typography';

type Props = RNTextProps & {
  variant?: TextVariant;
  color?:
    | 'text'
    | 'text2'
    | 'muted'
    | 'primary'
    | 'danger'
    | 'success'
    | 'warning';
  style?: StyleProp<TextStyle>;
};

const Text = ({ variant = 'body', color = 'text', style, ...rest }: Props) => {
  const { theme } = useTheme();

  return (
    <RNText
      testID="text"
      accessibilityLabel="text"
      {...rest}
      style={[
        theme.typography[variant],
        { color: theme.colours[color] },
        style,
      ]}
    />
  );
};

export { Text };
