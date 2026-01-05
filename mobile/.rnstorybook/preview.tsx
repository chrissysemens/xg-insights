import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import type { Preview } from '@storybook/react-native';

import { Button } from '../components/button/Button';
import { useTheme } from '../theme/useTheme';
import { AppLayout } from '../layout/AppLayout';
import { useAppStore, ThemeMode } from '../state/useAppStore';

const Background = ({ children }: { children: React.ReactNode }) => {
  const { theme } = useTheme();

  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);

  return (
    <View style={[styles.root, { backgroundColor: theme.colours.bg }]}>
      <View style={styles.toolbar}>
        <Button
          text="Toggle theme"
          variant="secondary"
          size="sm"
          onPress={() =>
            setThemeMode(themeMode === 'dark' ? 'light' : 'dark')
          }
        />
      </View>

      <View style={styles.content}>{children}</View>
    </View>
  );
};

const ThemeSync = ({ mode }: { mode: 'light' | 'dark' }) => {
  const setThemeMode = useAppStore((s) => s.setThemeMode);

  useEffect(() => {
    // Keep storybook toolbar and app store in sync
    setThemeMode(mode as ThemeMode);
  }, [mode, setThemeMode]);

  return null;
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },

  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Global theme for stories',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
      },
    },
  },

  decorators: [
    (Story, context) => {
      const mode = context.globals.theme as 'light' | 'dark';

      return (
        <AppLayout>
          <ThemeSync mode={mode} />
          <Background>
            <Story />
          </Background>
        </AppLayout>
      );
    },
  ],
};

export default preview;

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: { padding: 16, paddingBottom: 8 },
  content: { flex: 1, padding: 16 },
});
