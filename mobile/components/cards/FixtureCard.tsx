import React from 'react';
import { View, Pressable, Image } from 'react-native';
import { Text } from '../text/Text';
import { chipStyleForTone, highlightMeta } from '@/utils/highlight-reason';
import { useTranslation } from 'react-i18next';

type FixtureCardProps = {
  fixtureId: string;
  fixture: any;
  prediction: any;
  homeName: string;
  awayName: string;
  homeImage?: string | null;
  awayImage?: string | null;
  theme: any;
  showConfidence?: boolean;
  highlightPick?: boolean;
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

const teamStyle = (which: 'home' | 'away', pick?: 'H' | 'D' | 'A', c?: any) => {
  if (!pick || pick === 'D') return { color: c.text };
  if (pick === 'H' && which === 'home') return { color: c.primary };
  if (pick === 'A' && which === 'away') return { color: c.primary };
  return { color: c.text };
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
  showConfidence = false,
  highlightPick = false,
}) => {
  const c = theme.colours;
  const { t } = useTranslation();
  const meta = highlightMeta(prediction.highlightReason);
  const chip = chipStyleForTone(meta.tone, c);

  const confRaw = showConfidence ? getResultConf(prediction) * 100 : 0;
  const conf = roundToNearest25(confRaw);

  const pick = highlightPick
    ? (prediction?.matchResult?.pick as 'H' | 'D' | 'A' | undefined)
    : undefined;

  return (
    <Pressable
      key={fixtureId}
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

      <View
        style={{
          marginTop: theme.spacing[2],
          alignSelf: 'flex-start',
          paddingHorizontal: theme.spacing[3],
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
          {meta.icon} {meta.label}
        </Text>
      </View>

      {highlightPick ? (
        <View
          style={{
            marginTop: theme.spacing[2],
            flexDirection: 'row',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {homeImage && (
            <Image
              source={{ uri: homeImage }}
              style={{
                width: theme.sizes.iconMd,
                height: theme.sizes.iconMd,
                marginRight: theme.spacing[1],
              }}
            />
          )}
          <Text
            style={{
              ...theme.typography.label,
              fontFamily: theme.fontFamilies.bold,
              ...teamStyle('home', pick, c),
            }}
          >
            {homeName}
          </Text>

          <Text
            style={{
              ...theme.typography.label,
              fontFamily: theme.fontFamilies.bold,
              color: c.text,
            }}
          >
            {' '}
            vs{' '}
          </Text>

          {awayImage && (
            <Image
              source={{ uri: awayImage }}
              style={{
                width: theme.sizes.iconMd,
                height: theme.sizes.iconMd,
                marginLeft: theme.spacing[1],
              }}
            />
          )}
          <Text
            style={{
              ...theme.typography.label,
              fontFamily: theme.fontFamilies.bold,
              ...teamStyle('away', pick, c),
            }}
          >
            {awayName}
          </Text>
        </View>
      ) : (
        <View
          style={{
            marginTop: theme.spacing[2],
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          {homeImage && (
            <Image
              source={{ uri: homeImage }}
              style={{
                width: theme.sizes.iconMd,
                height: theme.sizes.iconMd,
                marginRight: theme.spacing[1],
              }}
            />
          )}
          <Text
            style={{
              ...theme.typography.label,
              fontFamily: theme.fontFamilies.bold,
              color: c.text,
            }}
          >
            {homeName} vs {awayName}
          </Text>
          {awayImage && (
            <Image
              source={{ uri: awayImage }}
              style={{
                width: theme.sizes.iconMd,
                height: theme.sizes.iconMd,
                marginLeft: theme.spacing[1],
              }}
            />
          )}
        </View>
      )}

      {showConfidence && (
        <Text
          style={{
            marginTop: theme.spacing[2],
            ...theme.typography.caption,
            fontFamily: theme.fontFamilies.bold,
            color: c.primary,
          }}
        >
          {t('home.resultConfidence', { conf })}
        </Text>
      )}

      {(prediction.over25 || prediction.btts) && (
        <View
          style={{
            marginTop: theme.spacing[3],
            flexDirection: 'row',
            gap: theme.spacing[2],
            flexWrap: 'wrap',
          }}
        >
          {prediction.over25 && prediction.over25.pick === 'Y' && (
            <View
              style={{
                paddingHorizontal: theme.spacing[3],
                paddingVertical: theme.spacing[1],
                borderRadius: theme.radii.pill,
                backgroundColor: c.surface2,
                borderWidth: theme.components.borderWidth,
                borderColor: c.border,
              }}
            >
              <Text style={{ ...theme.typography.caption, color: c.text2 }}>
                {t('home.over25')}
              </Text>
            </View>
          )}

          {prediction.btts && prediction.btts.pick === 'Y' && (
            <View
              style={{
                paddingHorizontal: theme.spacing[3],
                paddingVertical: theme.spacing[1],
                borderRadius: theme.radii.pill,
                backgroundColor: c.surface2,
                borderWidth: theme.components.borderWidth,
                borderColor: c.border,
              }}
            >
              <Text style={{ ...theme.typography.caption, color: c.text2 }}>
                {t('home.btts')}
              </Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
};
