import { Stack } from '@/layout/Stack';
import { DualSeries } from '@/components/charts/DualSeries';
import { toLineData } from './helpers';
import { Xg } from '@/types';
import { useTranslation } from 'react-i18next';

type xGChartsProps = {
  xg: Xg;
};

const XgCharts = ({ xg }: xGChartsProps) => {
  const { t } = useTranslation();
  return (
    <Stack gap={5} fullWidth>
      <DualSeries
        title={t('fixture.xgForLast5')}
        homeLabel={t('common.home').toUpperCase()}
        awayLabel={t('common.away').toUpperCase()}
        homeAvg={xg.homeLast5ForAvg}
        awayAvg={xg.awayLast5ForAvg}
        home={toLineData(xg.homeLast5For)}
        away={toLineData(xg.awayLast5For)}
        height={170}
        duration={700}
        xLabelMode="game"
      />

      <DualSeries
        title={t('fixture.xgAgainstLast5')}
        homeLabel="HOME"
        awayLabel="AWAY"
        homeAvg={xg.homeLast5AgainstAvg}
        awayAvg={xg.awayLast5AgainstAvg}
        home={toLineData(xg.homeLast5Against)}
        away={toLineData(xg.awayLast5Against)}
        height={170}
        duration={700}
        xLabelMode="game"
      />
    </Stack>
  );
};

export { XgCharts };
