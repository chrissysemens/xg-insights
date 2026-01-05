import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ThemeMode = 'system' | 'light' | 'dark';

type AppState = {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      setThemeMode: (themeMode) => set({ themeMode }),
    }),
    {
      name: 'fbm-app-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ themeMode: s.themeMode }),
    },
  ),
);
