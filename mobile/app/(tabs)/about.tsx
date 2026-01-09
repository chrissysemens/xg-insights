import React from 'react';
import { AppLayout } from '@/layout/AppLayout';
import { Screen } from '@/layout/Screen';
import { Stack } from '@/layout/Stack';
import { Text } from '@/components';
import { useTheme } from '@/theme/useTheme';
import { Header } from '@/components/header/Header';
import { spacing } from '@/theme/tokens';

export default function AboutScreen() {
  const { theme } = useTheme();
  const colours = theme.colours;

  return (
    <AppLayout>
      <Screen>
        <Stack gap={3}>
          <Text style={{ color: colours.text, fontSize: 18 }}>
            About Football Boost Machine
          </Text>
          <Text style={{ color: colours.muted }}>
            This app provides football predictions and analytics using machine
            learning models.
          </Text>
          {/* Add about content here */}
        </Stack>
      </Screen>
    </AppLayout>
  );
}
