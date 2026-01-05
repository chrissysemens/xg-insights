import React from 'react';
import { View, ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';

type Props = ViewProps & {
  children: React.ReactNode;
  padded?: boolean;
  safe?: boolean;
};

export function AppLayout({
  children,
  padded = false,
  safe = false,
  style,
  ...props
}: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      {...props}
      style={[
        {
          flex: 1,
          backgroundColor: theme.colours.bg,
          paddingTop: safe ? insets.top : 0,
          paddingBottom: safe ? insets.bottom : 0,
        },
        padded && {
          paddingHorizontal: theme.spacing[4],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
