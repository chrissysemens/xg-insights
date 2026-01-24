import { useTheme } from '@/theme/useTheme';
import { View } from 'react-native';
import { Text } from '@/components/text/Text';
import { Row } from '@/layout/Row';

const LikelyScores = ({
  scores,
}: {
  scores: { h: number; a: number; p: number }[];
}) => {
  const { theme } = useTheme();
  const c = theme.colours;

  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderRadius: 16,
        padding: theme.spacing[3],
      }}
    >
      <Text
        style={{
          ...theme.typography.body,
          fontFamily: theme.fontFamilies.bold,
          color: c.text,
          marginBottom: 8,
        }}
      >
        Most likely scores
      </Text>

      <View style={{ gap: 6 }}>
        {scores.slice(0, 4).map((s, i) => (
          <Row key={i} style={{ alignItems: 'center' }}>
            <Text style={{ ...theme.typography.body, color: c.text }}>
              {s.h}–{s.a}
            </Text>

            <View style={{ flex: 1 }} />

            <Text style={{ ...theme.typography.caption, color: c.muted }}>
              {(s.p * 100).toFixed(1)}%
            </Text>
          </Row>
        ))}
      </View>
    </View>
  );
};

export { LikelyScores };
