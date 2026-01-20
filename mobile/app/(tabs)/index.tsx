import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppLayout } from '@/layout/AppLayout';
import { Screen } from '@/layout/Screen';
import { Stack } from '@/layout/Stack';
import { Text, FixtureCard } from '@/components';
import { useTheme } from '@/theme/useTheme';
import { Header } from '@/components/header/Header';

import { useHighlightedPredictions } from '@/hooks/useHighlightedPredictions';

type TeamDoc = {
  id: number;
  name: string;
  shortCode?: string | null;
  imagePath?: string | null;
};

const getGoalsScore = (p: any) => {
  // New: single chosen goals badge from backend (never both)
  const gp = p?.goalsPick;
  if (gp?.pick === 'Y' && typeof gp?.prob === 'number') return gp.prob;

  // Fallback for older docs
  const o = p?.over25?.Y ?? 0;
  const b = p?.btts?.Y ?? 0;
  return Math.max(o, b);
};

const getResultConf = (p: any) =>
  Math.max(
    p?.matchResult?.H ?? 0,
    p?.matchResult?.D ?? 0,
    p?.matchResult?.A ?? 0,
  );

export default function Home() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const c = theme.colours;

  const highlights = useHighlightedPredictions();
  const items = highlights.data ?? [];

  const clearFavourites = useMemo(() => {
    return items
      .filter((x) => x.prediction.highlightReason === 'CLEAR_FAVOURITE')
      .sort((a, b) => getResultConf(b.prediction) - getResultConf(a.prediction));
  }, [items]);

  const goalHighlights = useMemo(() => {
    return items
      .filter((x) => x.prediction.highlightReason !== 'CLEAR_FAVOURITE')
      .sort((a, b) => getGoalsScore(b.prediction) - getGoalsScore(a.prediction));
  }, [items]);

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
          <View style={{ gap: theme.spacing[1] }}>
            <Text
              style={{
                ...theme.typography.body,
                fontFamily: theme.fontFamilies.bold,
                color: c.text,
              }}
            >
              {t('home.highlightedFixtures')}
            </Text>
            <Text style={{ ...theme.typography.caption, color: c.muted }}>
              {t('home.topPicksDescription')}
            </Text>
          </View>

          {highlights.loading && (
            <Text style={{ color: c.muted }}>{t('home.loadingHighlights')}</Text>
          )}

          {!!highlights.error && (
            <Text style={{ color: c.danger }}>
              {t('home.error', { error: highlights.error })}
            </Text>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: theme.spacing[6],
              gap: theme.spacing[3],
            }}
          >
            {clearFavourites.length > 0 && (
              <View style={{ gap: theme.spacing[2] }}>
                <Text
                  style={{
                    ...theme.typography.label,
                    fontFamily: theme.fontFamilies.bold,
                    color: c.text,
                  }}
                >
                  {t('home.matchWinners')}
                </Text>

                {clearFavourites.map((item) => (
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
                    variant="winner"
                  />
                ))}
              </View>
            )}

            {goalHighlights.length > 0 && (
              <View style={{ gap: theme.spacing[2], marginTop: theme.spacing[2] }}>
                <Text
                  style={{
                    ...theme.typography.label,
                    fontFamily: theme.fontFamilies.bold,
                    color: c.text,
                  }}
                >
                  {t('home.goalsAndBtts')}
                </Text>

                {goalHighlights.map((item) => (
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
                    variant="goals"
                  />
                ))}
              </View>
            )}
          </ScrollView>
        </Stack>
      </Screen>
    </AppLayout>
  );
}
