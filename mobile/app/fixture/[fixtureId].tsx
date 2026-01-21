import React from 'react';
import { ScrollView, View, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { AppLayout } from '@/layout/AppLayout';
import { Screen } from '@/layout/Screen';
import { Stack } from '@/layout/Stack';
import { Text } from '@/components';
import { Header } from '@/components/header/Header';
import { useTheme } from '@/theme/useTheme';

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { useQuery } from '@tanstack/react-query';
import { Row } from '@/layout/Row';
import { FixtureDetailsDoc, FormLetter } from '@/types';
import { DualSeries } from '@/components/charts/DualSeries';
import { formatKickoff } from '@/components/cards/FixtureCard';

const getFixtureDetails = async (fixtureId: string) => {
  const snap = await getDoc(doc(db, 'fixture_details', fixtureId));
  if (!snap.exists()) return null;
  return snap.data() as FixtureDetailsDoc;
};

const clean5 = (arr?: number[]) =>
  (arr ?? [])
    .slice(0, 5)
    .map((v) => (Number.isFinite(v) ? Number(v.toFixed(2)) : 0));

const toLineData = (arr?: number[]) => {
  const vals = clean5(arr);
  return vals.map((y, i) => ({ x: i + 1, y }));
};

type PickChip = { key: string; label: string };

const buildPredictionChips = (data: FixtureDetailsDoc): PickChip[] => {
  const p = data.prediction;
  if (!p) return [];

  const chips: PickChip[] = [];

  // Always show match winner chip on details (matches list behaviour)
  chips.push({ key: 'mw', label: 'Match winner' });

  // Only show BTTS if pick is Y
  if (p.btts?.pick === 'Y') chips.push({ key: 'btts', label: 'BTTS' });

  // Only show Over 2.5 if pick is Y
  if (p.over25?.pick === 'Y') chips.push({ key: 'o25', label: 'Over 2.5' });

  return chips;
};

const PredictionChip = ({
  label,
  highlighted,
}: {
  label: string;
  highlighted?: boolean;
}) => {
  const { theme } = useTheme();
  const c = theme.colours;

  return (
    <View
      style={{
        backgroundColor: highlighted ? c.primarySoft : c.surface2,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Text style={{ ...theme.typography.caption, color: c.muted }}>
        {label}
      </Text>
    </View>
  );
};

type FormBadgeProps = {
  formLetter: FormLetter;
};

const FormBadge = ({ formLetter }: FormBadgeProps) => {
  const { theme } = useTheme();
  const backgroundColor =
    formLetter === 'W' ? '#4CAF50' : formLetter === 'D' ? '#FFC107' : '#F44336';

  return (
    <View
      style={{
        backgroundColor,
        minWidth: 20,
        borderRadius: 4,
        paddingHorizontal: 2,
        paddingVertical: 2,
        marginRight: 4,
        alignItems: 'center',
      }}
    >
      <Text style={theme.typography.caption}>{formLetter}</Text>
    </View>
  );
};

const scoreToResult = (h: number, a: number): 'H' | 'A' | 'D' =>
  h > a ? 'H' : h < a ? 'A' : 'D';

const FixtureDetails = () => {
  const { fixtureId } = useLocalSearchParams<{ fixtureId: string }>();
  const { theme } = useTheme();
  const c = theme.colours;

  const { data, isFetching } = useQuery<FixtureDetailsDoc | null>({
    queryKey: ['fixtureDetails', fixtureId],
    enabled: !!fixtureId,
    queryFn: () => getFixtureDetails(fixtureId!),
  });

  if (isFetching || !data) {
    return (
      <AppLayout>
        <Header />
        <Screen>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <Text style={{ ...theme.typography.body, color: theme.colours.muted }}>
              Loading…
            </Text>
          </ScrollView>
        </Screen>
      </AppLayout>
    );
  }

  const homeImg = data.home?.imagePath;
  const awayImg = data.away?.imagePath;

  const winnerPick = data.prediction?.matchResult?.pick; // 'H' | 'A' | 'D'
  const homeIsPick = winnerPick === 'H';
  const awayIsPick = winnerPick === 'A';

  const chips = buildPredictionChips(data);
  const isHighlighted = !!data.prediction?.highlighted;

  // --- Poisson helpers ---
  const factorial = (n: number): number => {
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  };

  const poissonP = (k: number, lambda: number) =>
    (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);

  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v));

  type Scoreline = { h: number; a: number; p: number };

  const topScorelines = (
    lambdaH: number,
    lambdaA: number,
    maxGoals = 5,
    top = 5,
  ) => {
    const scores: Scoreline[] = [];
    for (let h = 0; h <= maxGoals; h++) {
      for (let a = 0; a <= maxGoals; a++) {
        scores.push({ h, a, p: poissonP(h, lambdaH) * poissonP(a, lambdaA) });
      }
    }
    return scores.sort((x, y) => y.p - x.p).slice(0, top);
  };

  const computeLambdas = (d: FixtureDetailsDoc) => {
    const xg = d.xg;
    if (!xg) return null;

    const lambdaHome = (xg.homeLast5ForAvg + xg.awayLast5AgainstAvg) / 2;
    const lambdaAway = (xg.awayLast5ForAvg + xg.homeLast5AgainstAvg) / 2;

    return {
      home: clamp(lambdaHome * 1.05, 0.1, 6),
      away: clamp(lambdaAway, 0.1, 6),
    };
  };

  const lambdas = computeLambdas(data);
  const likely = lambdas ? topScorelines(lambdas.home, lambdas.away, 5, 5) : [];

  // --- Mismatch warning ---
  const top = likely[0];
  const likelyResult = top ? scoreToResult(top.h, top.a) : null;
  const pick = data.prediction?.matchResult?.pick ?? null;

  const scoreConflictsWithPick =
    !!pick && !!likelyResult && pick !== likelyResult;

  const WarningChip = ({ label }: { label: string }) => {
    // if you don't have warningSoft/warning in theme yet, swap to surface2 + text
    return (
      <View
        style={{
          backgroundColor: (c as any).warningSoft ?? c.surface2,
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderWidth: 1,
          borderColor: (c as any).warningSoft ?? c.border,
        }}
      >
        <Text
          style={{
            ...theme.typography.caption,
            color: (c as any).warning ?? c.text,
          }}
        >
          {label}
        </Text>
      </View>
    );
  };

  return (
    <AppLayout safe>
      <Header />
      <Screen>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {data.league?.name ? (
            <View style={{ alignItems: 'center', paddingTop: 6 }}>
              <Text
                style={{
                  ...theme.typography.caption,
                  color: theme.colours.text,
                  marginBottom: 4,
                }}
              >
                {`${data.league.name}`}
              </Text>
              <Text
                style={{
                  ...theme.typography.caption,
                  color: theme.colours.muted,
                }}
              >
                {`${data.startingAtTimestamp ? formatKickoff(data.startingAtTimestamp) : ''}`}
              </Text>
            </View>
          ) : null}

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
                  {data.home.name}
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
                  {data.away.name}
                </Text>
              </View>
            </Row>

            {/* form badges + chips under vs */}
            {data.form?.homeLast5?.length ||
            data.form?.awayLast5?.length ||
            chips.length ? (
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
                  {data.form?.homeLast5?.map((fl: FormLetter, i: number) => (
                    <FormBadge key={`h-${i}`} formLetter={fl} />
                  ))}
                </View>

                {/* Chips under vs */}
                <View
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {!!chips.length && (
                    <View
                      style={{
                        flexDirection: 'row',
                        gap: 6,
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                      }}
                    >
                      {chips.map((chip) => (
                        <PredictionChip
                          key={chip.key}
                          label={chip.label}
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
                  {data.form?.awayLast5?.map((fl: FormLetter, i: number) => (
                    <FormBadge key={`a-${i}`} formLetter={fl} />
                  ))}
                </View>
              </Row>
            ) : null}

            {/* poisson + likely scores */}
            {data.xg && lambdas ? (
              <View style={{ marginTop: 30 }}>
                <Stack gap={5} fullWidth>
                  <PoissonOutlook
                    homeName={data.home.name}
                    awayName={data.away.name}
                    lambdaHome={lambdas.home}
                    lambdaAway={lambdas.away}
                  />

                  {scoreConflictsWithPick ? (
                    <View style={{ alignItems: 'center', marginTop: 40 }}>
                      <WarningChip label="Most likely score does not match our pick" />
                    </View>
                  ) : null}

                  <LikelyScores scores={likely} />
                </Stack>
              </View>
            ) : null}

            {/* charts */}
            {data.xg ? (
              <View style={{ marginTop: 50 }}>
                <Stack gap={12} fullWidth>
                  <DualSeries
                    title="xG For (last 5)"
                    homeLabel="HOME"
                    awayLabel="AWAY"
                    homeAvg={data.xg.homeLast5ForAvg}
                    awayAvg={data.xg.awayLast5ForAvg}
                    home={toLineData(data.xg.homeLast5For)}
                    away={toLineData(data.xg.awayLast5For)}
                    height={170}
                    duration={700}
                    xLabelMode="game"
                  />

                  <DualSeries
                    title="xG Against (last 5)"
                    homeLabel="HOME"
                    awayLabel="AWAY"
                    homeAvg={data.xg.homeLast5AgainstAvg}
                    awayAvg={data.xg.awayLast5AgainstAvg}
                    home={toLineData(data.xg.homeLast5Against)}
                    away={toLineData(data.xg.awayLast5Against)}
                    height={170}
                    duration={700}
                    xLabelMode="game"
                  />
                </Stack>
              </View>
            ) : null}
          </Stack>
        </ScrollView>
      </Screen>
    </AppLayout>
  );
};

const PoissonOutlook = ({
  homeName,
  awayName,
  lambdaHome,
  lambdaAway,
}: {
  homeName: string;
  awayName: string;
  lambdaHome: number;
  lambdaAway: number;
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
        Score outlook
      </Text>

      <Row style={{ alignItems: 'center' }}>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ ...theme.typography.caption, color: c.muted }}>
            {homeName}
          </Text>
          <Text style={{ ...theme.typography.h2, color: c.primary, marginTop: 2 }}>
            {lambdaHome.toFixed(2)}
          </Text>
          <Text style={{ ...theme.typography.caption, color: c.muted }}>
            expected goals
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
            {awayName}
          </Text>
          <Text style={{ ...theme.typography.h2, color: c.text2, marginTop: 2 }}>
            {lambdaAway.toFixed(2)}
          </Text>
          <Text style={{ ...theme.typography.caption, color: c.muted }}>
            expected goals
          </Text>
        </View>
      </Row>
    </View>
  );
};

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

export default FixtureDetails;
