import React, { useMemo } from 'react';
import { View } from 'react-native';
import { CartesianChart, Line, Scatter } from 'victory-native';
import { useFont } from '@shopify/react-native-skia';
import { useTheme } from '@/theme/useTheme';
import { Text } from '@/components';

type Datum = { x: number; y: number };

type Props = {
  home: Datum[];
  away: Datum[];
  title?: string;
  subtitle?: string;
  homeLabel?: string;
  awayLabel?: string;
  homeAvg?: number | null;
  awayAvg?: number | null;
  height?: number;
  duration?: number;

  /** Force stable Y scale */
  yDomain?: [number, number];

  /** X axis label format */
  xLabelMode?: 'date' | 'game';

  /** Emphasise the latest point */
  emphasiseLatest?: boolean;

  /** Render the avg line under subtitle */
  showAverages?: boolean;
};

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const roundTo2dp = (v: number) => Number(v.toFixed(2));

export const DualSeries = ({
  home,
  away,
  title,
  subtitle,
  homeLabel = 'Home',
  awayLabel = 'Away',
  homeAvg,
  awayAvg,
  height = 180,
  duration = 700,
  yDomain,
  xLabelMode = 'game',
  emphasiseLatest = true,
  showAverages = true,
}: Props) => {
  const { theme } = useTheme();
  const c = theme.colours;
  const [animate, setAnimate] = React.useState(false);

  const axisFont = useFont(
    require('../../assets/fonts/Inter_18pt-Regular.ttf'),
    10,
  );

  React.useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const awayColor = c.text2; // or c.muted if you want it subtler

  // Merge data points by x value
  const merged = useMemo(() => {
    const map = new Map<number, { x: number; home?: number; away?: number }>();

    for (const d of home ?? []) {
      map.set(d.x, { x: d.x, home: d.y, away: map.get(d.x)?.away });
    }
    for (const d of away ?? []) {
      map.set(d.x, { x: d.x, away: d.y, home: map.get(d.x)?.home });
    }

    return [...map.values()].sort((a, b) => a.x - b.x);
  }, [home, away]);

  // Santitize data for display
  const displayData = useMemo(() => {
    return merged.map((d) => ({
      x: d.x,
      home: d.home == null ? null : roundTo2dp(clamp(d.home, 0, 10)),
      away: d.away == null ? null : roundTo2dp(clamp(d.away, 0, 10)),
    }));
  }, [merged]);

  // YDomain (xgFriendly)
  const computedYDomain = useMemo<[number, number]>(() => {
    if (yDomain) return yDomain;

    const vals: number[] = [];
    for (const d of displayData) {
      if (typeof d.home === 'number') vals.push(d.home);
      if (typeof d.away === 'number') vals.push(d.away);
    }
    if (!vals.length) return [0, 4];

    const max = Math.max(...vals);

    // Space for stroke and marker
    const VISUAL_BUFFER = 0.8;

    const padded = max + VISUAL_BUFFER;
    const niceMax = Math.ceil(padded * 2) / 2;

    return [0, Math.max(4, niceMax)];
  }, [displayData, yDomain]);

  const xTicks = useMemo(() => {
    if (xLabelMode === 'game') return [1, 2, 3, 4, 5];
    const xs = displayData.map((d) => d.x);
    if (!xs.length) return xs;

    const maxTicks = 6;
    const step = Math.max(1, Math.floor(xs.length / maxTicks));
    const ticks = xs.filter((_, i) => i % step === 0);

    if (ticks[ticks.length - 1] !== xs[xs.length - 1])
      ticks.push(xs[xs.length - 1]);

    return ticks;
  }, [displayData, xLabelMode]);

  const hasEnoughForLine = displayData.length >= 2;

  const avgLine =
    showAverages && (homeAvg != null || awayAvg != null) ? (
      <Text
        style={{ ...theme.typography.caption, color: c.muted, marginTop: 2 }}
      >
        {homeAvg != null ? `${homeLabel} ${roundTo2dp(homeAvg)}` : homeLabel}
        {'  •  '}
        {awayAvg != null ? `${awayLabel} ${roundTo2dp(awayAvg)}` : awayLabel}
      </Text>
    ) : null;

  return (
    <View
      style={{
        alignSelf: 'stretch',
        backgroundColor: c.surface,
        borderRadius: 16,
        padding: theme.spacing[3],
      }}
    >
      {(title || subtitle || avgLine) && (
        <View>
          {!!title && (
            <Text
              style={{
                ...theme.typography.body,
                fontFamily: theme.fontFamilies.bold,
                color: c.text,
              }}
            >
              {title}
            </Text>
          )}

          {avgLine}
        </View>
      )}

      <View
        style={{
          height,
          backgroundColor: c.surface2,
          borderRadius: 12,
          overflow: 'visible',
          opacity: 0.95,
        }}
      >
        <CartesianChart
          data={displayData}
          xKey="x"
          yKeys={['home', 'away']}
          padding={{ top: 28, bottom: 20, left: 15, right: 15 }}
          domain={{ y: computedYDomain }}
          xAxis={{
            axisSide: 'bottom',
            labelColor: c.muted,
            tickValues: xTicks,
            labelPosition: 'outset',
            font: axisFont,
            formatXLabel: (label) => {
              if (xLabelMode === 'date') {
                const d = new Date(Number(label));
                const day = d.getDate();
                const month = d.getMonth() + 1;
                return `${day}/${month}`;
              }
              return `G${Number(label)}`;
            },
          }}
          yAxis={[
            {
              axisSide: 'left',
              labelColor: c.muted,
              tickCount: 4,
              domain: computedYDomain,
              labelPosition: 'outset',
              font: axisFont,
              formatYLabel: (label) => {
                const v = Number(label ?? 0);
                // Mobile formatting for labels
                return v === 0 || v === computedYDomain[1] ? v.toFixed(1) : '';
              },
            },
          ]}
        >
          {({ points }) => {
            const homePts = points.home ?? [];
            const awayPts = points.away ?? [];

            const homeLast = homePts[homePts.length - 1];
            const awayLast = awayPts[awayPts.length - 1];

            return (
              <>
                {hasEnoughForLine && (
                  <>
                    <Line
                      points={homePts}
                      color={c.primary}
                      strokeWidth={2.25}
                      opacity={1}
                      animate={
                        animate ? { type: 'timing', duration } : undefined
                      }
                    />
                    <Line
                      points={awayPts}
                      color={awayColor}
                      strokeWidth={1.5}
                      opacity={0.75}
                      animate={
                        animate ? { type: 'timing', duration } : undefined
                      }
                    />
                  </>
                )}

                {emphasiseLatest && homeLast && (
                  <Scatter points={[homeLast]} color={c.primary} radius={4} />
                )}
                {emphasiseLatest && awayLast && (
                  <Scatter points={[awayLast]} color={awayColor} radius={4} />
                )}
              </>
            );
          }}
        </CartesianChart>

        {/** Labels */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: theme.spacing[2],
            top: theme.spacing[2],
            gap: 4,
            backgroundColor: 'rgba(0,0,0,0.15)',
            paddingHorizontal: 6,
            paddingVertical: 4,
            borderRadius: 6,
          }}
        >
          <Text style={{ ...theme.typography.caption, color: c.primary }}>
            {homeLabel.toUpperCase()}
          </Text>
          <Text style={{ ...theme.typography.caption, color: awayColor }}>
            {awayLabel.toUpperCase()}
          </Text>
        </View>

        {emphasiseLatest ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: theme.spacing[2],
              top: theme.spacing[2],
            }}
          />
        ) : null}
      </View>
    </View>
  );
};
