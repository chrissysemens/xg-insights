import { useTheme } from '@/theme/useTheme';
import { View } from 'react-native';
import { Text } from '@/components/text/Text';
import { Row } from '@/layout/Row';
import { FixtureDetailsDoc, Market1x2 } from '@/types';
import { computeLambdas } from '@/utils/poisson';
import { useTranslation } from 'react-i18next';

type xgTotalsProps = {
  fixture: FixtureDetailsDoc;
  market1x2?: Market1x2 | null;
};

const XgTotals = ({ fixture, market1x2 }: xgTotalsProps) => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const c = theme.colours;
  const lambdas = computeLambdas(fixture);

  const fmtOdd = (v: number | null | undefined) =>
    typeof v === 'number' ? v.toFixed(2) : '–';

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
        {t('fixture.scoreOutlook')}
      </Text>

      <Row style={{ alignItems: 'center' }}>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ ...theme.typography.caption, color: c.muted }}>
            {fixture.home.name}
          </Text>
          <Text
            style={{ ...theme.typography.h2, color: c.primary, marginTop: 2 }}
          >
            {lambdas?.home?.toFixed(2)}
          </Text>
          <Text style={{ ...theme.typography.caption, color: c.muted }}>
            {t('fixture.expectedGoals')}
          </Text>
        </View>

        <View
          style={{
            width: 1,
            height: 46,
            backgroundColor: c.border,
            opacity: 0.7,
          }}
        />

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ ...theme.typography.caption, color: c.muted }}>
            {fixture.away.name}
          </Text>
          <Text
            style={{ ...theme.typography.h2, color: c.text2, marginTop: 2 }}
          >
            {lambdas?.away?.toFixed(2)}
          </Text>
          <Text style={{ ...theme.typography.caption, color: c.muted }}>
            {t('fixture.expectedGoals')}
          </Text>
        </View>
      </Row>
      <View style={{marginTop: 30}}>
        {market1x2 ? (
          <Text
            style={{
              ...theme.typography.caption,
              color: c.muted,
              opacity: 0.7,
            }}
          >
            Market (1X2): {fmtOdd(market1x2.home)} • {fmtOdd(market1x2.draw)} •{' '}
            {fmtOdd(market1x2.away)}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

export { XgTotals };

