import React, { useMemo } from 'react';
import { View } from 'react-native';
import { CartesianChart, Line } from 'victory-native';
import { useTheme } from '@/theme/useTheme';
import { Text } from '@/components';

type Datum = { x: number; y: number };

type Props = {
  data: Datum[];
  title?: string;
  subtitle?: string;
  width?: number;
  height?: number;
  duration?: number;
};
export const AnimatedLine = ({
  data,
  height = 180, // height of the CHART AREA only
  duration = 900,
}: {
  data: Datum[];
  height?: number;
  duration?: number;
}) => {
  const { theme } = useTheme();
  const c = theme.colours;

  const sorted = useMemo(
    () => [...data].sort((a, b) => a.x - b.x),
    [data]
  );

  return (
    <View
      style={{
        alignSelf: 'stretch',
        backgroundColor: c.surface,
        borderRadius: 16,
        padding: theme.spacing[3], // ✅ card padding
      }}
    >
      {/* Header */}
      <View style={{ marginBottom: theme.spacing[2] }}>
        <Text
          style={{
            ...theme.typography.body,
            fontFamily: theme.fontFamilies.bold,
            color: c.text,
          }}
        >
          Performance over time
        </Text>
        <Text style={{ ...theme.typography.caption, color: c.muted }}>
          Weekly accuracy (%)
        </Text>
      </View>

      {/* Chart area */}
      <View
        style={{
          height, // ✅ height applies ONLY here
          backgroundColor: c.surface2,
          borderRadius: 12,
          overflow: 'hidden', // ✅ clips chart properly
        }}
      >
        <CartesianChart
          data={sorted}
          xKey="x"
          yKeys={['y']}
          padding={{ top: 16, bottom: 20, left: 36, right: 16 }}
        >
          {({ points }) => (
            <Line
              points={points.y}
              color={c.primary}
              strokeWidth={2}
              animate={{ type: 'timing', duration }}
            />
          )}
        </CartesianChart>
      </View>
    </View>
  );
};
