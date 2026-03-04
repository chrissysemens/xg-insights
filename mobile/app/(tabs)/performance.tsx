import React, { useMemo } from 'react';
import { AppLayout } from '@/layout/AppLayout';
import { Screen } from '@/layout/Screen';
import { Stack } from '@/layout/Stack';
import { Text } from '@/components';
import { useTheme } from '@/theme/useTheme';

import { useFirebase } from '@/hooks/useFirebase';
import { DonutChart, type DonutSlice } from '@/components/charts/Doughnut';

import {
  buildWeeklyResultAccuracy,
  calcResultAccuracy,
  calcSignalAccuracy,
} from '@/utils/accuracy';
import type { ArchivedFixtureDoc } from '@/types';
import { Header } from '@/components/header/Header';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Row } from '@/layout/Row';
import { AnimatedLine } from '@/components/charts/AnimatedLine';

export default function PerformanceScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
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
        { label: t('common.correct'), value: correct, color: c.success },
        { label: t('common.incorrect'), value: incorrect, color: c.surface2 },
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

  const weeklyResultLine = useMemo(
    () => buildWeeklyResultAccuracy(fixtures),
    [fixtures],
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

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: theme.spacing[6],
              gap: theme.spacing[3],
            }}
          >
            {!loading && !error && totalEvaluated > 0 && (
              <Stack gap={3}>
                <DonutChart
                  title={t('performance.overallAccuracy')}
                  data={resultDonut}
                  centerText={
                    result.total > 0
                      ? `${result.correct}/${result.total}\n${pct(result.correct, result.total)}%`
                      : t('performance.noPredictions')
                  }
                />

                <Row gap={3} align="flex-start" fullWidth>
                  <Stack flex={1} fullWidth style={{ minWidth: 0 }}>
                    <DonutChart
                      title={t('performance.over25Goals')}
                      data={over25Donut}
                      centerText={
                        result.total > 0
                          ? `${over25.correct}/${over25.total} ${pct(over25.correct, over25.total)}%`
                          : t('performance.noPredictions')
                      }
                    />
                  </Stack>

                  <Stack flex={1} fullWidth style={{ minWidth: 0 }}>
                    <DonutChart
                      title={t('common.btts')}
                      data={bttsDonut}
                      centerText={
                        result.total > 0
                          ? `${btts.correct}/${btts.total} ${pct(btts.correct, btts.total)}%`
                          : t('performance.noPredictions')
                      }
                    />
                  </Stack>
                </Row>
                <Row fullWidth>
                  <Stack gap={3} flex={1}>
                    <AnimatedLine
                      title={t('performance.overTime')}
                      subtitle={t('performance.weeklyAccuracy')}
                      data={weeklyResultLine}
                    />
                  </Stack>
                </Row>
              </Stack>
            )}
          </ScrollView>
        </Stack>
      </Screen>
    </AppLayout>
  );
}
