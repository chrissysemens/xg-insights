import { useColorScheme } from 'react-native';
import { useAppStore } from '../state/useAppStore';
import { darkColors, lightColors } from './colours';
import { spacing, radii, sizes } from './tokens';
import { typography } from './typography';

export type ResolvedTheme = 'light' | 'dark';

export function useTheme() {
  const system = useColorScheme();
  const themeMode = useAppStore((s) => s.themeMode);

  const resolved: ResolvedTheme =
    themeMode === 'system' ? (system === 'dark' ? 'dark' : 'light') : themeMode;

  const colours = resolved === 'dark' ? darkColors : lightColors;

  const theme = {
    mode: resolved,
    colours,
    spacing,
    radii,
    sizes,
    typography,
    components: {
      controlHeight: sizes.controlMd,
      controlRadius: radii.md,
      borderWidth: 1, // Test hairline
    },
  } as const;

  return { themeMode, resolved, theme };
}
