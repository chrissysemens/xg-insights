import { View } from 'react-native';
import { Text } from '../text/Text';

type BadgeProps = {
  theme: any;
  bg: string;
  border: string;
  fg: string;
  children: React.ReactNode;
};

export const Badge = ({ theme, bg, border, fg, children }: BadgeProps) => (
  <View
    style={{
      alignSelf: 'flex-start',
      paddingHorizontal: theme.spacing[2],
      paddingVertical: theme.spacing[1],
      borderRadius: theme.radii.pill,
      backgroundColor: bg,
      borderWidth: theme.components.borderWidth,
      borderColor: border,
    }}
  >
    <Text
      style={{
        ...theme.typography.caption,
        fontFamily: theme.fontFamilies.bold,
        color: fg,
      }}
    >
      {children}
    </Text>
  </View>
);
