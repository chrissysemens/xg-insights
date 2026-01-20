import React, { useMemo } from 'react';
import { View, Pressable, Image } from 'react-native';
import { Text } from '../text/Text';
import { chipStyleForTone, highlightMeta } from '@/utils/highlight-reason';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

type Pick = 'H' | 'D' | 'A';

type FixtureCardVariant = 'winner' | 'goals';

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

const formatKickoff = (ts: number) => {
  const d = new Date(ts * 1000);
  const day = d.toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${day} ${time}`;
};

const getResultConf = (p: any) =>
  Math.max(
    p?.matchResult?.H ?? 0,
    p?.matchResult?.D ?? 0,
    p?.matchResult?.A ?? 0,
  );

const roundToNearest25 = (p: number) => Math.round(p / 2.5) * 2.5;

const teamStyle = (which: 'home' | 'away', pick?: Pick, c?: any) => {
  if (!pick || pick === 'D') return { color: c.text };
  if (pick === 'H' && which === 'home') return { color: c.primary };
  if (pick === 'A' && which === 'away') return { color: c.primary };
  return { color: c.text };
};

const HighlightBadge = ({
  theme,
  colours: c,
  prediction,
}: {
  theme: any;
  colours: any;
  prediction: any;
}) => {
  const meta = highlightMeta(prediction.highlightReason);
  const chip = chipStyleForTone(meta.tone, c);

  const { t } = useTranslation();

  return (
    <View
      style={{
        marginTop: theme.spacing[2],
        alignSelf: 'flex-start',
        paddingHorizontal: theme.spacing[2],
        paddingVertical: theme.spacing[1],
        borderRadius: theme.radii.pill,
        backgroundColor: chip.bg,
        borderWidth: theme.components.borderWidth,
        borderColor: chip.border,
      }}
    >
      <Text
        style={{
          ...theme.typography.caption,
          fontFamily: theme.fontFamilies.bold,
          color: chip.fg,
        }}
      >
        {meta.icon} {t(meta.labelKey)}
      </Text>
    </View>
  );
};

type Props = {
  theme: any;
  colours: any;
  homeName: string;
  awayName: string;
  homeImage?: string | null;
  awayImage?: string | null;
  pick?: 'H' | 'D' | 'A';
};

export const TeamsRow: React.FC<Props> = ({
  theme,
  colours: c,
  homeName,
  awayName,
  homeImage,
  awayImage,
  pick,
}) => {
  const isHomePick = pick === 'H';
  const isAwayPick = pick === 'A';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: theme.spacing[3],
        gap: theme.spacing[3],
      }}
    >
      {/* HOME */}
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          minWidth: 0,
        }}
      >
        {!!homeImage && (
          <Image
            source={{ uri: homeImage }}
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              marginRight: theme.spacing[2],
            }}
          />
        )}
        <Text
          numberOfLines={1}
          style={{
            ...theme.typography.body,
            color: c.text,
            fontFamily: isHomePick
              ? theme.fontFamilies.bold
              : theme.fontFamilies.regular,
            flexShrink: 1,
          }}
        >
          {homeName}
        </Text>
      </View>

      {/* VS / spacer */}
      <Text style={{ ...theme.typography.caption, color: c.muted }}>vs</Text>

      {/* AWAY */}
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          minWidth: 0,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            ...theme.typography.body,
            color: c.text,
            fontFamily: isAwayPick
              ? theme.fontFamilies.bold
              : theme.fontFamilies.regular,
            flexShrink: 1,
            textAlign: 'right',
          }}
        >
          {awayName}
        </Text>
        {!!awayImage && (
          <Image
            source={{ uri: awayImage }}
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              marginLeft: theme.spacing[2],
            }}
          />
        )}
      </View>
    </View>
  );
};

const ConfidenceRow = ({
  theme,
  colours: c,
  prediction,
}: {
  theme: any;
  colours: any;
  prediction: any;
}) => {
  const { t } = useTranslation();
  const conf = roundToNearest25(getResultConf(prediction) * 100);

  return (
    <Text
      style={{
        marginTop: theme.spacing[2],
        marginLeft: theme.spacing[1],
        ...theme.typography.caption,
        fontFamily: theme.fontFamilies.bold,
        color: c.primary,
      }}
    >
      {t('home.resultConfidence', { conf })}
    </Text>
  );
};

const GoalsChips = ({
  theme,
  colours: c,
  prediction,
}: {
  theme: any;
  colours: any;
  prediction: any;
}) => {
  const { t } = useTranslation();
  const showOver = prediction.over25?.pick === 'Y';
  const showBtts = prediction.btts?.pick === 'Y';

  if (!showOver && !showBtts) return null;

  const chipStyle = {
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.radii.pill,
    backgroundColor: c.surface2,
    borderWidth: theme.components.borderWidth,
    borderColor: c.border,
  };

  return (
    <View
      style={{
        marginTop: theme.spacing[3],
        flexDirection: 'row',
        gap: theme.spacing[2],
        flexWrap: 'wrap',
      }}
    >
      {showOver && (
        <View style={chipStyle}>
          <Text style={{ ...theme.typography.caption, color: c.text2 }}>
            {t('home.over25')}
          </Text>
        </View>
      )}
      {showBtts && (
        <View style={chipStyle}>
          <Text style={{ ...theme.typography.caption, color: c.text2 }}>
            {t('home.btts')}
          </Text>
        </View>
      )}
    </View>
  );
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

  const pick: Pick | undefined = useMemo(() => {
    if (variant !== 'winner') return undefined;
    return prediction?.matchResult?.pick as Pick | undefined;
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

      <HighlightBadge theme={theme} colours={c} prediction={prediction} />

      <TeamsRow
        theme={theme}
        colours={c}
        homeName={homeName}
        awayName={awayName}
        homeImage={homeImage}
        awayImage={awayImage}
        pick={pick}
      />

      {variant === 'winner' && (
        <ConfidenceRow theme={theme} colours={c} prediction={prediction} />
      )}

      {variant === 'goals' && (
        <GoalsChips theme={theme} colours={c} prediction={prediction} />
      )}
    </Pressable>
  );
};
