// app/(tabs)/index.tsx
import React, { useMemo } from 'react';
import { View, Pressable } from 'react-native';
import { AppLayout } from '@/layout/AppLayout';
import { Screen } from '@/layout/Screen';
import { Stack } from '@/layout/Stack';
import { Text } from '@/components';
import { useTheme } from '@/theme/useTheme';
import { Header } from '@/components/header/Header';

import { useFirebase, WithId } from '@/hooks/useFirebase';
import { useHighlightedPredictions } from '@/hooks/useHighlightedPredictions';
import { chipStyleForTone, highlightMeta } from '@/utils/highlight-reason';

type TeamDoc = {
  id: number;
  name: string;
  shortCode?: string | null;
  imagePath?: string | null;
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

const ynLabel = (pick?: 'Y' | 'N') => (pick === 'Y' ? 'Likely' : 'Unlikely');

const getResultConf = (p: any) =>
  Math.max(p?.matchResult?.H ?? 0, p?.matchResult?.D ?? 0, p?.matchResult?.A ?? 0);

const getGoalsScore = (p: any) => {
  const o = p?.over25?.Y ?? 0;
  const b = p?.btts?.Y ?? 0;
  return (o + b) / 2;
};

const roundToNearest25 = (p: number) => Math.round(p / 2.5) * 2.5;

// ✅ NEW: highlight the expected winning team name (no "X favoured" text)
const teamStyle = (which: 'home' | 'away', pick?: 'H' | 'D' | 'A', c?: any) => {
  if (!pick || pick === 'D') return { color: c.text };
  if (pick === 'H' && which === 'home') return { color: c.primary };
  if (pick === 'A' && which === 'away') return { color: c.primary };
  return { color: c.text };
};

const FavouriteCard = ({
  fixtureId,
  fixture,
  prediction,
  homeName,
  awayName,
  c,
}: any) => {
  const meta = highlightMeta(prediction.highlightReason);
  const chip = chipStyleForTone(meta.tone, c);
  const confRaw = getResultConf(prediction) * 100;
  const conf = roundToNearest25(confRaw);

  const pick = prediction?.matchResult?.pick as 'H' | 'D' | 'A' | undefined;

  return (
    <Pressable
      key={fixtureId}
      style={{
        backgroundColor: c.surface,
        borderColor: c.border,
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
      }}
    >
      <Text style={{ fontSize: 12, color: c.muted }}>
        {formatKickoff(fixture.startingAtTimestamp)}
      </Text>

      <View
        style={{
          marginTop: 8,
          alignSelf: 'flex-start',
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: chip.bg,
          borderWidth: 1,
          borderColor: chip.border,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '700', color: chip.fg }}>
          {meta.icon} {meta.label}
        </Text>
      </View>

      {/* ✅ Updated: highlight the expected winner in primary colour */}
      <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap' }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: '700',
            ...teamStyle('home', pick, c),
          }}
        >
          {homeName}
        </Text>

        <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }}>
          {' '}vs{' '}
        </Text>

        <Text
          style={{
            fontSize: 15,
            fontWeight: '700',
            ...teamStyle('away', pick, c),
          }}
        >
          {awayName}
        </Text>
      </View>

      <Text style={{ marginTop: 8, fontSize: 13, fontWeight: '700', color: c.primary }}>
        {conf}% result confidence
      </Text>

      {(prediction.over25 || prediction.btts) && (
        <View style={{ marginTop: 10, flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {prediction.over25 && (
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: c.surface2,
                borderWidth: 1,
                borderColor: c.border,
              }}
            >
              <Text style={{ fontSize: 12, color: c.text2 }}>
                Over 2.5:{' '}
                <Text style={{ fontSize: 10, fontWeight: '700' }}>
                  {ynLabel(prediction.over25.pick)}
                </Text>
              </Text>
            </View>
          )}

          {prediction.btts && (
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: c.surface2,
                borderWidth: 1,
                borderColor: c.border,
              }}
            >
              <Text style={{ fontSize: 12, color: c.text2 }}>
                BTTS:{' '}
                <Text style={{ fontSize: 10, fontWeight: '700' }}>
                  {ynLabel(prediction.btts.pick)}
                </Text>
              </Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
};

const GoalsCard = ({ fixtureId, fixture, prediction, homeName, awayName, c }: any) => {
  const meta = highlightMeta(prediction.highlightReason);
  const chip = chipStyleForTone(meta.tone, c);

  return (
    <Pressable
      key={fixtureId}
      style={{
        backgroundColor: c.surface,
        borderColor: c.border,
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
      }}
    >
      <Text style={{ fontSize: 12, color: c.muted }}>
        {formatKickoff(fixture.startingAtTimestamp)}
      </Text>

      <View
        style={{
          marginTop: 8,
          alignSelf: 'flex-start',
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: chip.bg,
          borderWidth: 1,
          borderColor: chip.border,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '700', color: chip.fg }}>
          {meta.icon} {meta.label}
        </Text>
      </View>

      <Text style={{ marginTop: 8, fontSize: 15, fontWeight: '700', color: c.text }}>
        {homeName} vs {awayName}
      </Text>

      {(prediction.over25 || prediction.btts) && (
        <View style={{ marginTop: 10, flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {prediction.over25 && (
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: c.surface2,
                borderWidth: 1,
                borderColor: c.border,
              }}
            >
              <Text style={{ fontSize: 12, color: c.text2 }}>
                Over 2.5:{' '}
                <Text style={{ fontSize: 10, fontWeight: '700' }}>
                  {ynLabel(prediction.over25.pick)}
                </Text>
              </Text>
            </View>
          )}

          {prediction.btts && (
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: c.surface2,
                borderWidth: 1,
                borderColor: c.border,
              }}
            >
              <Text style={{ fontSize: 12, color: c.text2 }}>
                BTTS:{' '}
                <Text style={{ fontSize: 10, fontWeight: '700' }}>
                  {ynLabel(prediction.btts.pick)}
                </Text>
              </Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
};

export default function Home() {
  const { theme } = useTheme();
  const c = theme.colours;

  const teamsQ = useFirebase<TeamDoc>({
    collectionName: 'teams',
    constraintsKey: 'all-teams',
  });

  const teamsById = useMemo(() => {
    const map: Record<number, WithId<TeamDoc>> = {};
    for (const t of teamsQ.data) map[Number(t.id)] = t;
    return map;
  }, [teamsQ.data]);

  const highlights = useHighlightedPredictions();
  const items = highlights.data;

  const clearFavourites = useMemo(() => {
    return items
      .filter((x) => x.prediction.highlightReason === 'CLEAR_FAVOURITE')
      .sort((a, b) => getResultConf(b.prediction) - getResultConf(a.prediction));
  }, [items]);

  const goalHighlights = useMemo(() => {
    return items
      .filter((x) => x.prediction.highlightReason !== 'CLEAR_FAVOURITE')
      .sort((a, b) => getGoalsScore(b.prediction) - getGoalsScore(a.prediction));
  }, [items]);

  return (
    <AppLayout safe>
      <Header />

      <Screen scroll>
        <Stack
          gap={10}
          style={{
            paddingHorizontal: theme.spacing[4],
            paddingTop: theme.spacing[2],
            paddingBottom: theme.spacing[6],
          }}
        >
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>
              Highlighted fixtures
            </Text>
            <Text style={{ fontSize: 12, color: c.muted }}>
              Top picks from the latest model run
            </Text>
          </View>

          {(highlights.loading || teamsQ.loading) && (
            <Text style={{ color: c.muted }}>Loading highlights…</Text>
          )}

          {!!highlights.error && (
            <Text style={{ color: c.danger }}>Error: {highlights.error}</Text>
          )}

          {!highlights.loading && !items.length && !highlights.error && (
            <View
              style={{
                backgroundColor: c.surface,
                borderColor: c.border,
                borderWidth: 1,
                borderRadius: 16,
                padding: 14,
              }}
            >
              <Text style={{ color: c.text, fontWeight: '600' }}>
                No highlights yet
              </Text>
              <Text style={{ marginTop: 6, color: c.muted, fontSize: 13 }}>
                Run predictions and your top matches will show here.
              </Text>
            </View>
          )}

          {clearFavourites.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>
                Clear favourites
              </Text>

              {clearFavourites.map(({ fixtureId, fixture, prediction }) => {
                const homeName = teamsById[fixture.homeTeamId]?.name ?? 'Home';
                const awayName = teamsById[fixture.awayTeamId]?.name ?? 'Away';

                return (
                  <FavouriteCard
                    key={fixtureId}
                    fixtureId={fixtureId}
                    fixture={fixture}
                    prediction={prediction}
                    homeName={homeName}
                    awayName={awayName}
                    c={c}
                  />
                );
              })}
            </View>
          )}

          {goalHighlights.length > 0 && (
            <View style={{ gap: 8, marginTop: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }}>
                Goals & BTTS
              </Text>

              {goalHighlights.map(({ fixtureId, fixture, prediction }) => {
                const homeName = teamsById[fixture.homeTeamId]?.name ?? 'Home';
                const awayName = teamsById[fixture.awayTeamId]?.name ?? 'Away';

                return (
                  <GoalsCard
                    key={fixtureId}
                    fixtureId={fixtureId}
                    fixture={fixture}
                    prediction={prediction}
                    homeName={homeName}
                    awayName={awayName}
                    c={c}
                  />
                );
              })}
            </View>
          )}
        </Stack>
      </Screen>
    </AppLayout>
  );
}
