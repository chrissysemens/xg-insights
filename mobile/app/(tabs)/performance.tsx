import React from 'react';
import { AppLayout } from '@/layout/AppLayout';
import { Screen } from '@/layout/Screen';
import { Stack } from '@/layout/Stack';
import { Text } from '@/components';
import { useTheme } from '@/theme/useTheme';
import { Header } from '@/components/header/Header';

export default function PerformanceScreen() {
  const { theme } = useTheme();
  const colours = theme.colours;

  return (
    <AppLayout>
      <Header title="Performance" />
      <Screen>
        <Stack gap="md">
          <Text style={{ color: colours.text, fontSize: 18 }}>
            Performance Metrics
          </Text>
          <Text style={{ color: colours.muted }}>
            This is the Performance tab. Here you can view performance
            statistics and analytics.
          </Text>
          {/* Add performance content here */}
        </Stack>
      </Screen>
    </AppLayout>
  );
}
