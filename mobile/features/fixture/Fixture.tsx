import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Screen } from '@/layout/Screen';
import { Text } from '@/components/text/Text';
import { useTheme } from '@/theme/useTheme';

import { computeLambdas, topScorelines } from '@/utils/poisson';
import { FixtureDetailsDoc } from '@/types';
import { getFixtureDetails, scoreToResult } from '@/features/fixture/helpers';

import { FixtureHeader } from './FixtureHeaders';
import { FixtureTeams } from './FixtureTeams';
import { WarningBadge } from '@/features/badges/WarningBadge';
import { LikelyScores } from './LikelyScores';
import { XgCharts } from './XgCharts';
import { XgTotals } from './XgTotals';

type FixtureProps = {
  fixtureId: string;
};

const Fixture = ({ fixtureId }: FixtureProps) => {
  const { t } = useTranslation();
  const { theme } = useTheme();

  const { data, isLoading, isError, error } =
    useQuery<FixtureDetailsDoc | null>({
      queryKey: ['fixtureDetails', fixtureId],
      enabled: !!fixtureId,
      queryFn: () => getFixtureDetails(fixtureId),
      staleTime: 60_000,
    });

  const { likely, scoreConflictsWithPick } = useMemo(() => {
    if (!data)
      return {
        likely: [] as { h: number; a: number; p: number }[],
        scoreConflictsWithPick: false,
      };

    const lambdas = computeLambdas(data);
    const likelyScores = lambdas
      ? topScorelines(lambdas.home, lambdas.away, 5, 5)
      : [];

    const top = likelyScores[0];
    const likelyResult = top ? scoreToResult(top.h, top.a) : null;
    const pick = data.prediction?.matchResult?.pick ?? null;

    const conflict = !!pick && !!likelyResult && pick !== likelyResult;

    return { likely: likelyScores, scoreConflictsWithPick: conflict };
  }, [data]);

  if (isLoading) {
    return (
      <Screen>
        <Text>{t('loading')}</Text>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <Text>{t('error')}</Text>
        {__DEV__ ? (
          <Text
            style={{
              ...theme.typography.caption,
              opacity: 0.7,
              marginTop: theme.spacing[2],
            }}
          >
            {String((error as any)?.message ?? error)}
          </Text>
        ) : null}
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        <Text>{t('noData')}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: theme.spacing[3],
          gap: theme.spacing[3],
        }}
      >
        <FixtureHeader fixture={data} />
        <FixtureTeams fixture={data} />

        {data.xg ? (
          <View style={{ marginTop: theme.spacing[3] }}>
            <XgTotals
              fixture={data}
              market1x2={data.odds?.market1x2?.decimal ?? null}
            />
          </View>
        ) : null}

        {scoreConflictsWithPick ? (
          <View style={{ alignItems: 'center', marginTop: theme.spacing[2] }}>
            <WarningBadge label={t('fixture.conflictWarning')} />
          </View>
        ) : null}

        <View style={{ marginTop: theme.spacing[2] }}>
          <LikelyScores scores={likely} />
        </View>

        {data.xg ? (
          <View style={{ marginTop: theme.spacing[2] }}>
            <XgCharts xg={data.xg} />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
};

export { Fixture };
