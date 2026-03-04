import React from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Stack } from '@/layout/Stack';
import { useTheme } from '@/theme/useTheme';
import { FixtureCard, Text } from '@/components';
import { useHighlightsForTab, Tab } from '@/hooks/useHighlight';

type HighlightsListProps = {
  tab: Tab;
  titleKey: string;
  subtitleKey?: string;
  variant: 'winner' | 'goals' | 'interesting';
  take?: number;
};

export const HighlightList = ({
  tab,
  titleKey,
  subtitleKey,
  variant,
  take = 50,
}: HighlightsListProps) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const c = theme.colours;

  const res = useHighlightsForTab(tab, take);
  const items = (res.data ?? []).filter((item) => {
    // Only show fixtures starting less than 2 hours ago or in the future
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const now = Date.now();
    return (
      typeof item.fixture?.startingAtTimestamp === 'number' &&
      item.fixture.startingAtTimestamp * 1000 >= now - TWO_HOURS_MS
    );
  });

  return (
    <Stack
      gap={3}
      style={{
        flex: 1,
        paddingHorizontal: theme.spacing[4],
        paddingTop: theme.spacing[2],
        paddingBottom: theme.spacing[6],
      }}
    >
      <View style={{ gap: theme.spacing[1] }}>
        <Text
          style={{
            ...theme.typography.body,
            fontFamily: theme.fontFamilies.bold,
            color: c.text,
            marginBottom: 10,
          }}
        >
          {t(titleKey)}
        </Text>

        {subtitleKey ? (
          <Text
            style={{
              ...theme.typography.caption,
              color: c.muted,
              marginBottom: 20,
            }}
          >
            {t(subtitleKey)}
          </Text>
        ) : null}
      </View>

      {res.loading && (
        <Text style={{ color: c.muted }}>{t('home.loadingHighlights')}</Text>
      )}

      {!!res.error && (
        <Text style={{ color: c.danger }}>
          {t('home.error', { error: res.error })}
        </Text>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: theme.spacing[6],
          gap: theme.spacing[3],
        }}
      >
        {items.map((item) => (
          <FixtureCard
            key={item.fixtureId}
            fixtureId={item.fixtureId}
            fixture={item.fixture}
            prediction={item.prediction}
            homeName={item.homeTeam?.name ?? 'Home'}
            awayName={item.awayTeam?.name ?? 'Away'}
            homeImage={item.homeTeam?.imagePath}
            awayImage={item.awayTeam?.imagePath}
            theme={theme}
            variant={variant}
          />
        ))}
      </ScrollView>
    </Stack>
  );
};
