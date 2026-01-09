// layout/Flex.tsx
import React from 'react';
import { View, ViewProps, ViewStyle } from 'react-native';
import { useTheme } from '../theme/useTheme';

type SpaceKey = keyof ReturnType<typeof useTheme>['theme']['spacing'];

export type FlexProps = ViewProps & {
  direction?: 'row' | 'column';
  gap?: SpaceKey;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
  flex?: number;
  fill?: boolean;
  fullWidth?: boolean;
};

export function Flex({
  direction = 'column',
  gap,
  align = 'stretch',
  justify,
  wrap = false,
  flex,
  fill = false,
  fullWidth = false,
  style,
  children,
  ...props
}: FlexProps) {
  const { theme } = useTheme();
  const kids = React.Children.toArray(children).filter(Boolean);

  const gapValue = gap != null ? theme.spacing[gap] : 0;
  const isRow = direction === 'row';

  return (
    <View
      {...props}
      style={[
        fullWidth && { alignSelf: 'stretch', width: '100%' },
        (fill || flex != null) && { flex: fill ? 1 : flex },
        {
          flexDirection: direction,
          alignItems: align,
          justifyContent: justify,
          flexWrap: wrap ? 'wrap' : 'nowrap',
        },
        style,
      ]}
    >
      {kids.map((child, i) => {
        const spacingStyle =
          gapValue && i > 0
            ? isRow
              ? ({ marginLeft: gapValue } as ViewStyle)
              : ({ marginTop: gapValue } as ViewStyle)
            : null;

        if (!spacingStyle) return child;

        // ✅ If it's a valid element and it has a style prop, inject into it.
        if (React.isValidElement(child)) {
          const props = child.props as any;

          if ('style' in props) {
            return React.cloneElement(child as React.ReactElement<any>, {
              style: [spacingStyle, props.style],
            });
          }
        }

        // ✅ Otherwise fall back to a wrapper (for Fragments, custom components without style, etc.)
        return (
          <View key={i} style={spacingStyle}>
            {child as any}
          </View>
        );
      })}
    </View>
  );
}
