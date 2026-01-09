import React from 'react';
import { View } from 'react-native';
import { PolarChart, Pie, type PieSliceData } from 'victory-native';
import { Text } from '@/components';
import { useTheme } from '@/theme/useTheme';

export type DonutSlice = {
  label: string;
  value: number;
  color: string;
};

type Props = {
  title: string;
  data: DonutSlice[];
  size?: number;
  innerRadius?: number | string;
  centerText?: string;
};

export function DonutChart({
  title,
  data,
  size = 180,
  innerRadius = '65%',
  centerText,
}: Props) {
  const { theme } = useTheme();
  const colours = theme.colours;
  const PieChart: any = Pie.Chart;

  return (
    <View
      style={{
        backgroundColor: colours.surface,
        borderRadius: 16,
        padding: 14,
      }}
    >
      <Text variant="h3" style={{ color: colours.text, fontSize: 16 }}>
        {title}
      </Text>

      <View style={{ alignItems: 'center', marginTop: 10 }}>
        <View style={{ width: size, height: size }}>
          <PolarChart
            data={data}
            colorKey="color"
            valueKey="value"
            labelKey="label"
          >
            <PieChart innerRadius={innerRadius} startAngle={-90}>
              {(slice: PieSliceData) => <Pie.Slice />}
            </PieChart>
          </PolarChart>

          {!!centerText && (
            <View
              style={{
                position: 'absolute',
                inset: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                variant="bodyStrong"
                style={{ color: colours.text, fontSize: 18 }}
              >
                {centerText}
              </Text>
            </View>
          )}
        </View>

        <View style={{ alignSelf: 'stretch', marginTop: 10 }}>
          {data.map((d) => (
            <View
              key={d.label}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 6,
              }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  marginRight: 8,
                  backgroundColor: d.color,
                }}
              />
              <Text style={{ color: colours.text2, fontSize: 12 }}>
                {d.label}: {d.value}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
