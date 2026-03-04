import React, { useMemo } from 'react';
import { Pressable } from 'react-native';
import { Text } from '../../text/Text';
import {
  formatKickoff,
} from '@/utils/highlight-reason';
import { router } from 'expo-router';
import { FixtureCardVariant, ResultPick } from '@/types';
import { TeamsRow } from './TeamsRow';
import { ConfidenceRow } from './ConfidenceRow';
import { GoalsBadgeRow } from './GoalsBadgeRow';
import { TopBadgeRow } from './TopBadgeRow';

type FixtureCardProps = {
  fixtureId: string;
  fixture: any;
  prediction: any;
  homeName: string;
  awayName: string;
  homeImage?: string | null;
  awayImage?: string | null;
  theme: any;
  variant: FixtureCardVariant;
};

export const FixtureCard: React.FC<FixtureCardProps> = ({
  fixtureId,
  fixture,
  prediction,
  homeName,
  awayName,
  homeImage,
  awayImage,
  theme,
  variant,
}) => {
  const c = theme.colours;

  const pick: ResultPick | undefined = useMemo(() => {
    if (variant !== 'winner') return undefined;
    return prediction?.matchResult?.pick as ResultPick | undefined;
  }, [variant, prediction]);

  return (
    <Pressable
      key={fixtureId}
      onPress={() => router.push(`/fixture/${fixture.id}`)}
      style={{
        backgroundColor: c.surface,
        borderColor: c.border,
        borderWidth: theme.components.borderWidth,
        borderRadius: theme.radii.lg,
        padding: theme.spacing[4],
      }}
    >
      <Text style={{ ...theme.typography.caption, color: c.muted }}>
        {formatKickoff(fixture.startingAtTimestamp)}
      </Text>

      <TopBadgeRow
        theme={theme}
        colours={c}
        prediction={prediction}
        variant={variant}
      />

      <TeamsRow
        theme={theme}
        colours={c}
        homeName={homeName}
        awayName={awayName}
        homeImage={homeImage}
        awayImage={awayImage}
        pick={pick}
        winnerColourEnabled={variant === 'winner'}
      />

      {variant === 'winner' && (
        <ConfidenceRow theme={theme} colours={c} prediction={prediction} />
      )}

      {variant !== 'interesting' && (
        <GoalsBadgeRow theme={theme} colours={c} prediction={prediction} />
      )}
    </Pressable>
  );
};
