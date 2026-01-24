import React from 'react';
import { computeLambdas, topScorelines } from '@/utils/poisson';
import { FixtureDetailsDoc } from '@/types';
import { FixtureHeader } from './FixtureHeaders';
import { FixtureTeams } from './FixtureTeams';
import { getFixtureDetails, scoreToResult } from '@/fetatures/fixture/helpers';
import { LikelyScores } from './LikelyScores';
import { ScrollView, View } from 'react-native';
import { Screen } from '@/layout/Screen';
import { Text } from '@/components/text/Text';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/theme/useTheme';
import { useTranslation } from 'react-i18next';
import { WarningBadge } from '@/fetatures/badges/WarningBadge';
import { XgCharts } from './XgCharts';
import { XgTotals } from './XgTotals';

type FixtureProps = {
  fixtureId: string;
};

const Fixture = ({ fixtureId }: FixtureProps) => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  const { data, isFetching } = useQuery<FixtureDetailsDoc | null>({
    queryKey: ['fixtureDetails', fixtureId],
    enabled: !!fixtureId,
    queryFn: () => getFixtureDetails(fixtureId!),
  });

  if (isFetching) {
    return (
      <Screen>
        <Text>{t('loading')}</Text>
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

  const lambdas = computeLambdas(data);
  const likely = lambdas ? topScorelines(lambdas.home, lambdas.away, 5, 5) : [];

  const top = likely[0];
  const likelyResult = top ? scoreToResult(top.h, top.a) : null;
  const pick = data.prediction?.matchResult?.pick ?? null;

  const scoreConflictsWithPick =
    !!pick && !!likelyResult && pick !== likelyResult;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <FixtureHeader fixture={data} />
        <FixtureTeams fixture={data} />
        {data.xg ? (
          <View style={{ marginTop: 30 }}>
            <XgTotals fixture={data} />
          </View>
        ) : null}
        {scoreConflictsWithPick ? (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <WarningBadge label="Most likely score does not match our pick" />
          </View>
        ) : null}
        <LikelyScores scores={likely} />
        {data.xg ? (
          <View style={{ marginTop: 50 }}>
            <XgCharts xg={data.xg} />
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
};

export { Fixture };
