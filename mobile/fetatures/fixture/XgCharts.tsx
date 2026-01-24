import { Stack } from '@/layout/Stack';
import { DualSeries } from '@/components/charts/DualSeries';
import { toLineData } from './helpers';
import { Xg } from '@/types';

type xGChartsProps = {
  xg: Xg;
};

const XgCharts = ({ xg }: xGChartsProps) => {
  return (
    <Stack gap={12} fullWidth>
      <DualSeries
        title="xG For (last 5)"
        homeLabel="HOME"
        awayLabel="AWAY"
        homeAvg={xg.homeLast5ForAvg}
        awayAvg={xg.awayLast5ForAvg}
        home={toLineData(xg.homeLast5For)}
        away={toLineData(xg.awayLast5For)}
        height={170}
        duration={700}
        xLabelMode="game"
      />

      <DualSeries
        title="xG Against (last 5)"
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

export { XgCharts }
