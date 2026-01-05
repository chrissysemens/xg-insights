import React, { useMemo, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { Text } from '../text/Text';
import { useTheme } from '../../theme/useTheme';
import { Spinner } from '../spinner/Spinner';

export type DropdownOption = {
  label: string;
  value: string;
};

type Props = {
  label: string;
  placeholder: string;
  options: DropdownOption[];
  value?: string | number | null;
  onChange: (value: string | null) => void;
  isLoading?: boolean;
  isDisabled?: boolean;
  fullWidth?: boolean;
  testID?: string;
};

const Dropdown = ({
  label,
  placeholder,
  options,
  value,
  onChange,
  isLoading = false,
  isDisabled = false,
  fullWidth = false,
  testID,
}: Props) => {
  const [open, setOpen] = useState(false);
  const { theme } = useTheme();

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const disabled = isDisabled || isLoading;

  return (
    <View style={{ width: fullWidth ? '100%' : undefined }}>
      <Text
        variant="label"
        color="text2"
        style={{ marginBottom: theme.spacing[1] }}
      >
        {label}
      </Text>

      <TouchableOpacity
        testID={testID || 'dropdown'}
        accessibilityLabel={testID || 'dropdown'}
        activeOpacity={0.85}
        style={[
          styles.dropdown,
          {
            height: theme.components.controlHeight,
            borderRadius: theme.components.controlRadius,
            paddingHorizontal: theme.spacing[3],
            width: '100%',

            // ✅ use existing tokens
            backgroundColor: disabled
              ? theme.colours.surface2
              : theme.colours.surface,

            borderColor: theme.colours.border,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
        onPress={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
        disabled={disabled}
      >
        {isLoading ? (
          <Spinner size="sm" color={theme.colours.muted} thickness={2} />
        ) : (
          <Text
            variant="body"
            color={selected ? 'text' : 'muted'}
            numberOfLines={1}
          >
            {selected ? selected.label : placeholder}
          </Text>
        )}
      </TouchableOpacity>

      {open && !disabled && (
        <View
          style={[
            styles.options,
            {
              marginTop: theme.spacing[1],
              backgroundColor: theme.colours.surface,
              borderColor: theme.colours.border,
              borderRadius: theme.radii.md,
            },
          ]}
        >
          {options.map((option) => {
            const isSelected = selected?.value === option.value;

            return (
              <TouchableOpacity
                key={option.value}
                activeOpacity={0.85}
                style={[
                  styles.option,
                  {
                    paddingVertical: theme.spacing[3],
                    paddingHorizontal: theme.spacing[3],
                    backgroundColor: isSelected
                      ? theme.colours.primarySoft
                      : theme.colours.surface,
                  },
                ]}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <Text variant="body" color={isSelected ? 'primary' : 'text'}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  options: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  option: {},
});

export { Dropdown}