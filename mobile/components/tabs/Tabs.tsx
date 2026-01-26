import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/text/Text';
import { useTheme } from '@/theme/useTheme';

export type PillTabOption<T extends string> = {
  key: T;
  label: string;
  badge?: number; // optional count
};

type TabsProps<T extends string> = {
  value: T;
  onChange: (next: T) => void;
  options: Array<PillTabOption<T>>;
  testID?: string;
};

export function Tabs<T extends string>({
  value,
  onChange,
  options,
  testID,
}: TabsProps<T>) {
  const { theme } = useTheme();
  const c = theme.colours;

  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        gap: theme.spacing[2],
        padding: theme.spacing[2]
      }}
    >
      {options.map((opt) => {
        const active = opt.key === value;

        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={({ pressed }) => ({
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: active ? c.primarySoft : c.surface2,
              borderWidth: 1,
              borderColor: active ? c.primarySoft : c.border,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                ...theme.typography.caption,
                fontFamily: active ? theme.fontFamilies.bold : undefined,
                color: active ? c.text : c.muted,
              }}
            >
              {opt.label}
            </Text>

            {typeof opt.badge === 'number' ? (
              <View
                style={{
                  minWidth: 18,
                  paddingHorizontal: 6,
                  height: 18,
                  borderRadius: 999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? c.primary : c.border,
                }}
              >
                <Text
                  style={{
                    ...theme.typography.caption,
                    fontSize: 11,
                    lineHeight: 12,
                    color: active ? c.surface : c.text,
                  }}
                >
                  {opt.badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
