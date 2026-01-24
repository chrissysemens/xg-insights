import { Row } from '@/layout/Row';
import { Stack } from '@/layout/Stack';
import { View } from 'react-native';
import { Image } from 'react-native';
import { Text } from '@/components/text/Text';
import { FixtureDetailsDoc, Result } from '@/types';
import { FormBadge } from '@/fetatures/badges/FormBadge';
import { PredictionBadge } from '@/fetatures/badges/PredictionBadge';
import { buildPredictionBadges } from './helpers';
import { useTheme } from '@/theme/useTheme';

type FixtureTeamsProps = {
  fixture: FixtureDetailsDoc;
};

const FixtureTeams = ({ fixture }: FixtureTeamsProps) => {
  const { theme } = useTheme();

  const homeImg = fixture.home?.imagePath;
  const awayImg = fixture.away?.imagePath;

  const winnerPick = fixture.prediction?.matchResult?.pick; // 'H' | 'A' | 'D'
  const homeIsPick = winnerPick === 'H';
  const awayIsPick = winnerPick === 'A';

  const badges = buildPredictionBadges(fixture);
  const isHighlighted = !!fixture.prediction?.highlighted;

  return (
    <Stack gap={5} fullWidth>
      {/* crests */}
      <Row style={{ paddingTop: 50 }}>
        <View style={{ flex: 1, alignItems: 'center' }}>
          {homeImg ? (
            <Image
              source={{ uri: homeImg }}
              style={{
                width: theme.sizes.controlLg,
                height: theme.sizes.controlLg,
              }}
            />
          ) : (
            <View
              style={{
                width: theme.sizes.controlLg,
                height: theme.sizes.controlLg,
                borderRadius: theme.radii.lg,
                backgroundColor: theme.colours.surface,
              }}
            />
          )}
        </View>

        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              ...theme.typography.caption,
              color:
                winnerPick === 'D'
                  ? theme.colours.primary
                  : theme.colours.muted,
            }}
          >
            vs
          </Text>
        </View>

        <View style={{ flex: 1, alignItems: 'center' }}>
          {awayImg ? (
            <Image
              source={{ uri: awayImg }}
              style={{
                width: theme.sizes.controlLg,
                height: theme.sizes.controlLg,
              }}
            />
          ) : (
            <View
              style={{
                width: theme.sizes.controlLg,
                height: theme.sizes.controlLg,
                borderRadius: theme.radii.lg,
                backgroundColor: theme.colours.surface,
              }}
            />
          )}
        </View>
      </Row>

      {/* team names (highlight pick) */}
      <Row gap={0}>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text
            style={{
              ...theme.typography.h3,
              textAlign: 'center',
              color: homeIsPick ? theme.colours.primary : theme.colours.text,
            }}
          >
            {fixture.home.name}
          </Text>
        </View>

        <View style={{ flex: 1 }} />

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text
            style={{
              ...theme.typography.h3,
              textAlign: 'center',
              color: awayIsPick ? theme.colours.primary : theme.colours.text,
            }}
          >
            {fixture.away.name}
          </Text>
        </View>
      </Row>

      {/* form badges + under vs */}
      {fixture.form?.homeLast5?.length ||
      fixture.form?.awayLast5?.length ||
      badges.length ? (
        <Row style={{ alignItems: 'center', marginTop: 8 }}>
          {/* Home form */}
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            {fixture.form?.homeLast5?.map((r: Result, i: number) => (
              <FormBadge key={`h-${i}`} result={r} />
            ))}
          </View>

          {/* Badges under vs */}
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {!!badges.length && (
              <View
                style={{
                  flexDirection: 'row',
                  gap: 6,
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                }}
              >
                {badges.map((badge) => (
                  <PredictionBadge
                    key={badge.key}
                    label={badge.label}
                    highlighted={isHighlighted}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Away form */}
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            {fixture.form?.awayLast5?.map((r: Result, i: number) => (
              <FormBadge key={`a-${i}`} result={r} />
            ))}
          </View>
        </Row>
      ) : null}
    </Stack>
  );
};

export { FixtureTeams };
