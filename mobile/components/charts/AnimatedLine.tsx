import React, { useMemo } from 'react';
import { View } from 'react-native';
import { CartesianChart, Line, Scatter } from 'victory-native';
import { useFont } from '@shopify/react-native-skia';
import { useTheme } from '@/theme/useTheme';
import { Text } from '@/components';

type Datum = { x: number; y: number };

type Props = {
  data: Datum[];
  title?: string;
  subtitle?: string;
  height?: number;
  duration?: number;
};

export const AnimatedLine = ({
  title,
  subtitle,
  data,
  height = 180,
  duration = 900,
}: Props) => {
  const { theme } = useTheme();
  const c = theme.colours;

  const axisFont = useFont(
    require('../../assets/fonts/Inter_18pt-Regular.ttf'),
    10,
  );

  const sorted = useMemo(() => [...data].sort((a, b) => a.x - b.x), [data]);

  const displayData = useMemo(() => {
    if (!sorted.length) return sorted;
    return sorted.map((d) => ({ x: d.x, y: Math.max(0, Math.min(100, d.y)) }));
  }, [sorted]);

  const xTicks = useMemo(() => {
    const xs = displayData.map((d) => d.x);
    if (xs.length === 0) return xs;

    const maxTicks = 6;
    const step = Math.max(1, Math.floor(xs.length / maxTicks));
    const ticks = xs.filter((_, i) => i % step === 0);

    if (ticks[ticks.length - 1] !== xs[xs.length - 1])
      ticks.push(xs[xs.length - 1]);
    return ticks;
  }, [displayData]);

  const hasEnoughForLine = displayData.length >= 2;

  return (
    <View
      style={{
        alignSelf: 'stretch',
        backgroundColor: c.surface,
        borderRadius: 16,
        padding: theme.spacing[3],
      }}
    >
      {(title || subtitle) && (
        <View style={{ marginBottom: theme.spacing[2] }}>
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

          {!!subtitle && (
            <Text style={{ ...theme.typography.caption, color: c.muted }}>
              {subtitle}
            </Text>
          )}
        </View>
      )}

      <View
        style={{
          height,
          backgroundColor: c.surface2,
          borderRadius: 12,
          overflow: 'visible',
        }}
      >
        <CartesianChart
          data={displayData}
          xKey="x"
          yKeys={['y']}
          padding={{ top: 15, bottom: 20, left: 15, right: 15 }}
          domain={{ y: [0, 100] }}
          xAxis={{
            axisSide: 'bottom',
            labelColor: c.muted,
            tickValues: xTicks,
            labelPosition: 'outset',
            font: axisFont,
            formatXLabel: (label) => {
              const d = new Date(Number(label));
              const day = d.getDate();
              const month = d.getMonth() + 1;
              return `${day}/${month}`;
            },
          }}
          yAxis={[
            {
              axisSide: 'left',
              labelColor: c.muted,
              tickCount: 5,
              domain: [0, 100],
              labelPosition: 'outset',
              font: axisFont,
              formatYLabel: (label) => {
                const v = Math.round(Number(label ?? 0));
                return v === 0 || v === 100 ? `${v}%` : '';
              },
            },
          ]}
        >
          {({ points }) => {
            const pts = points.y ?? [];
            const last = pts[pts.length - 1];

            return (
              <>
                {hasEnoughForLine && (
                  <Line
                    points={pts}
                    color={c.primary}
                    strokeWidth={2}
                    animate={{ type: 'timing', duration }}
                  />
                )}

                {last && <Scatter points={[last]} color={c.primary} />}
              </>
            );
          }}
        </CartesianChart>
      </View>
    </View>
  );
};
