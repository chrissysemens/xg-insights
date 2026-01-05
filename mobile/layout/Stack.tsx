import React from 'react';
import { View, ViewProps, ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';

type SpaceKey = keyof ReturnType<typeof useTheme>['theme']['spacing'];

type Props = ViewProps & {
  gap?: SpaceKey;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
};

export const Stack = ({
  gap = 3,
  align,
  justify,
  style,
  children,
  ...props
}: Props) => {
  const { theme } = useTheme();
  const kids = React.Children.toArray(children).filter(Boolean);

  return (
    <View
      {...props}
      style={[{ alignItems: align, justifyContent: justify }, style]}
    >
      {kids.map((child, i) => (
        <View
          key={i}
          style={i === 0 ? undefined : { marginTop: theme.spacing[gap] }}
        >
          {child}
        </View>
      ))}
    </View>
  );
};
