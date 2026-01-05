import React, { useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useTheme } from '../theme/useTheme';
import { AppLayout } from 'layout/AppLayout';

export default function RootLayout() {
  const { resolved, theme } = useTheme();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 1000 * 60 * 10, // 10 mins
            gcTime: 1000 * 60 * 60, // 1 hour
            refetchOnReconnect: true,
            refetchOnWindowFocus: false,
            experimental_prefetchInRender: true,
          },
        },
      }),
  );

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
          <StatusBar
            style={resolved === 'dark' ? 'light' : 'dark'}
            backgroundColor={theme.colours.bg}
          />
          <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
