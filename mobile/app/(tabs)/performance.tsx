import React, { useMemo } from 'react';
import { AppLayout } from '@/layout/AppLayout';
import { Screen } from '@/layout/Screen';
import { Stack } from '@/layout/Stack';
import { Text } from '@/components';
import { useTheme } from '@/theme/useTheme';

import { useFirebase } from '@/hooks/useFirebase';
import { DonutChart, type DonutSlice } from '@/components/charts/Doughnut';

import { buildWeeklyResultAccuracy, calcResultAccuracy, calcSignalAccuracy } from '@/utils/accuracy';
import type { ArchivedFixtureDoc } from '@/types';
import { Header } from '@/components/header/Header';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Row } from '@/layout/Row';
import { AnimatedLine } from '@/components/charts/AnimatedLine';

export default function PerformanceScreen() {
  const { theme } = useTheme();
  const c = theme.colours;

  const {
    data: fixtures,
    loading,
    error,
  } = useFirebase<ArchivedFixtureDoc>({
    collectionName: 'fixtures_archive',
  });

  const {
    totalEvaluated,
    result,
    btts,
    over25,
    resultDonut,
    bttsDonut,
    over25Donut,
  } = useMemo(() => {
    const evaluated = fixtures.filter((d) => d.evaluationDone);

    const result = calcResultAccuracy(evaluated);
    const btts = calcSignalAccuracy(evaluated, 'btts');
    const over25 = calcSignalAccuracy(evaluated, 'over25');

    const toDonut = (correct: number, total: number): DonutSlice[] => {
      const incorrect = Math.max(0, total - correct);
      return [
        { label: 'Correct', value: correct, color: c.success },
        { label: 'Incorrect', value: incorrect, color: c.surface2 },
      ].filter((x) => x.value > 0);
    };

    return {
      totalEvaluated: evaluated.length,

      result,
      btts,
      over25,

      resultDonut: toDonut(result.correct, result.total),
      bttsDonut: toDonut(btts.correct, btts.total),
      over25Donut: toDonut(over25.correct, over25.total),
    };
  }, [fixtures, c.success, c.surface2]);

  const pct = (correct: number, total: number) =>
    total > 0 ? Math.round((correct / total) * 100) : 0;

  /*const weeklyResultLine = useMemo(
    () => buildWeeklyResultAccuracy(fixtures),
    [fixtures]
);*/

const MOCK_WEEKLY_RESULT_LINE = [
  { x: Date.parse('2025-11-04'), y: 42 },
  { x: Date.parse('2025-11-11'), y: 47 },
  { x: Date.parse('2025-11-18'), y: 51 },
  { x: Date.parse('2025-11-25'), y: 49 },
  { x: Date.parse('2025-12-02'), y: 55 },
  { x: Date.parse('2025-12-09'), y: 58 },
  { x: Date.parse('2025-12-16'), y: 61 },
  { x: Date.parse('2025-12-23'), y: 63 },
];

  const { t } = useTranslation();

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
          <View>
            <Text
              style={{
                ...theme.typography.body,
                fontFamily: theme.fontFamilies.bold,
                color: c.text,
              }}
            >
              {t('performance.modelPerformance')}
            </Text>
            <Text style={{ ...theme.typography.caption, color: c.muted }}>
              {t('performance.performanceDescription')}
            </Text>
          </View>
          {!loading && !error && totalEvaluated > 0 && (
            <Stack gap={3}>
              <DonutChart
                title="Match Result Accuracy"
                data={resultDonut}
                centerText={
                  result.total > 0
                    ? `${result.correct}/${result.total}\n${pct(result.correct, result.total)}%`
                    : 'No predictions'
                }
              />

              <Row gap={3} align="flex-start" fullWidth>
                <Stack flex={1} fullWidth style={{ minWidth: 0 }}>
                  <DonutChart
                    title="Match Result Accuracy"
                    data={resultDonut}
                    centerText={
                      result.total > 0
                        ? `${result.correct}/${result.total}\n${pct(result.correct, result.total)}%`
                        : 'No predictions'
                    }
                  />
                </Stack>

                <Stack flex={1} fullWidth style={{ minWidth: 0 }}>
                  <DonutChart
                    title="Match Result Accuracy"
                    data={resultDonut}
                    centerText={
                      result.total > 0
                        ? `${result.correct}/${result.total}\n${pct(result.correct, result.total)}%`
                        : 'No predictions'
                    }
                  />
                </Stack>
              </Row>
              <Row fullWidth>
                <Stack gap={3} flex={1}>
                  <AnimatedLine data={MOCK_WEEKLY_RESULT_LINE} />
                </Stack>
                </Row>
            </Stack>
          )}
        </Stack>
      </Screen>
    </AppLayout>
  );
}
