import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/layout/AppLayout';
import { Header } from '@/components';
import { Screen, Stack } from '@/layout';
import { useTheme } from '@/theme/useTheme';
import { Tabs } from '@/components/tabs/Tabs';

import { Goals, Interesting, Picks } from '@/features/highlights';
import { View } from 'react-native';

type Tab = 'picks' | 'goals' | 'interesting' | 'explore';

export default function Home() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('picks');

  const options = useMemo(
    () => [
      {
        key: 'picks' as const,
        label: t('home.strongSignals') || 'Strong signals',
      },
      { key: 'goals' as const, label: t('home.highGoals') || 'High goals' },
      {
        key: 'interesting' as const,
        label: t('home.value') || 'value',
      },
            {
        key: 'explore' as const,
        label: t('home.explore') || 'Explore',
      },
    ],
    [t],
  );

  return (
    <AppLayout safe>
      <Header />
      <Screen>
        <Stack
          gap={3}
          style={{
            flex: 1,
            paddingHorizontal: theme.spacing[4],
            paddingTop: theme.spacing[2],
            paddingBottom: theme.spacing[6],
          }}
        >
          <Tabs<Tab> value={tab} onChange={setTab} options={options} />

          <View style={{ flex: 1 }}>
            {tab === 'picks' ? <Picks /> : null}
            {tab === 'goals' ? <Goals /> : null}
            {tab === 'interesting' ? <Interesting /> : null}
            {tab === 'explore' ? <Interesting /> : null}
          </View>
        </Stack>
      </Screen>
    </AppLayout>
  );
}
