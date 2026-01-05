import React from 'react';
import { View } from 'react-native';
import { Text } from '../components/text/Text';
import { Stack } from '../layout/Stack';
import { useTheme } from '../theme/useTheme';

type Props = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function Section({ title, description, children }: Props) {
  const { theme } = useTheme();

  return (
    <Stack gap={3}>
      <Stack gap={1}>
        <Text variant="h3">{title}</Text>
        {description && (
          <Text variant="body" color="muted">
            {description}
          </Text>
        )}
      </Stack>

      <View>{children}</View>
    </Stack>
  );
}
