import React, { forwardRef, useState } from 'react';
import {
  TextInput as RNTextInput,
  View,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { Text } from '../text/Text';

type Props = TextInputProps & {
  label?: string;
  error?: string;
  helperText?: string;
  containerStyle?: ViewStyle;
};

const Input = forwardRef<RNTextInput, Props>(
  (
    {
      label,
      error,
      helperText,
      style,
      containerStyle,
      onFocus,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const { theme } = useTheme();
    const [focused, setFocused] = useState(false);

    const borderColor = error
      ? theme.colours.danger
      : focused
        ? theme.colours.primary
        : theme.colours.border;

    return (
      <View style={[styles.wrapper, containerStyle]}>
        {label ? (
          <Text
            testID="input-label"
            accessibilityLabel="input-label"
            variant="label"
            color="text2"
            style={{ marginBottom: theme.spacing[1] }}
          >
            {label}
          </Text>
        ) : null}

        <RNTextInput
          testID="text-input"
          accessibilityLabel="text-input"
          ref={ref}
          placeholderTextColor={theme.colours.muted}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.inputBase,
            {
              height: theme.components.controlHeight,
              paddingHorizontal: theme.spacing[3],
              borderRadius: theme.components.controlRadius,
              backgroundColor: focused
                ? theme.colours.surface2
                : theme.colours.surface,
              color: theme.colours.text,
              borderColor,
            },
            // Apply your default text style consistently
            theme.typography.body,
            style,
          ]}
          {...props}
        />

        {error ? (
          <Text
            variant="caption"
            color="danger"
            style={{ marginTop: theme.spacing[1] }}
          >
            {error}
          </Text>
        ) : helperText ? (
          <Text
            variant="caption"
            color="muted"
            style={{ marginTop: theme.spacing[1] }}
          >
            {helperText}
          </Text>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  inputBase: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});

Input.displayName = 'Input';
export { Input };
