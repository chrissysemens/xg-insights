import React from 'react';
import { ScrollView, View, ViewProps } from 'react-native';
import { useTheme } from '../theme/useTheme';

type Props = ViewProps & {
  scroll?: boolean;
  padded?: boolean;
};

export const Screen = ({
  scroll = false,
  padded = false,
  style,
  children,
  ...props
}: Props) => {
  const { theme } = useTheme();

  const contentStyle = [padded && { padding: theme.spacing[4] }, style];

  if (scroll) {
    return (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          { flexGrow: 1 },
          ...(Array.isArray(style) ? style : [style]),
        ]}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View {...props} style={[{ flex: 1 }, ...contentStyle]}>
      {children}
    </View>
  );
};
