import { FixtureCardVariant } from '@/types';
import { chipStyleForTone, highlightMeta } from '@/utils/highlight-reason';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Badge } from '../../badge/Badge';

type TopBadgeRowProps = {
  theme: any;
  colours: any;
  prediction: any;
  variant: FixtureCardVariant;
};

export const TopBadgeRow = ({
  theme,
  colours: c,
  prediction,
  variant,
}: TopBadgeRowProps) => {
  const { t } = useTranslation();

  // shared chip styling helpers
  const neutral = { bg: c.surface2, border: c.border, fg: c.text2 };

  if (variant === 'winner') {
    const meta = highlightMeta(prediction?.highlightReason);
    const chip = chipStyleForTone(meta.tone, c);
    return (
      <View
        style={{
          marginTop: theme.spacing[2],
          flexDirection: 'row',
          gap: theme.spacing[2],
          flexWrap: 'wrap',
        }}
      >
        <Badge theme={theme} bg={chip.bg} border={chip.border} fg={chip.fg}>
          {meta.icon} {t(meta.labelKey)}
        </Badge>
      </View>
    );
  }

  if (variant === 'goals') {
    // Force a goals-focused badge (don’t rely on highlightReason)
    const gp = prediction?.goalsPick as
      | { kind: 'btts' | 'over25'; pick: 'Y'; prob: number }
      | null
      | undefined;

    const kind = gp?.kind ?? null;

    return (
      <View
        style={{
          marginTop: theme.spacing[2],
          flexDirection: 'row',
          gap: theme.spacing[2],
          flexWrap: 'wrap',
        }}
      >
        <Badge
          theme={theme}
          bg={neutral.bg}
          border={neutral.border}
          fg={neutral.fg}
        >
          {kind === 'over25' ? t('home.highGoals') : t('home.bttsLikely')}
        </Badge>

        {/* optional: show probability */}
        {typeof gp?.prob === 'number' ? (
          <Badge
            theme={theme}
            bg={neutral.bg}
            border={neutral.border}
            fg={neutral.fg}
          >
            {(gp.prob * 100).toFixed(0)}%
          </Badge>
        ) : null}
      </View>
    );
  }

  const im = prediction?.interestingMeta as
    | {
        bestKey?: 'home' | 'draw' | 'away';
        bestDelta?: number;
        threshold?: number;
      }
    | null
    | undefined;

  if (!im?.bestKey || typeof im.bestDelta !== 'number') {
    return null;
  }

  const sideValueKey =
    im.bestKey === 'home'
      ? 'home.pill.homeValue'
      : im.bestKey === 'away'
        ? 'home.awayValue'
        : 'home.drawValue';

  const delta = `${im.bestDelta >= 0 ? '+' : ''}${(im.bestDelta * 100).toFixed(1)}%`;

  return (
    <View
      style={{
        marginTop: theme.spacing[2],
        flexDirection: 'row',
        gap: theme.spacing[2],
        flexWrap: 'wrap',
      }}
    >
      <Badge
        theme={theme}
        bg={neutral.bg}
        border={neutral.border}
        fg={neutral.fg}
      >
        {t(sideValueKey, { delta })}
      </Badge>
    </View>
  );
};
