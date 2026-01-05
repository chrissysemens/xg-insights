import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/useTheme';

const Divider = () => {
  const { theme } = useTheme();

  return (
    <View
      testID="divider"
      accessibilityLabel="divider"
      style={{
        height: 1,
        backgroundColor: theme.colours.border,
        marginVertical: theme.spacing[4],
      }}
    />
  );
};

export { Divider };
