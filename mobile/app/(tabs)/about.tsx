import React from 'react';
import { AppLayout } from '@/layout/AppLayout';
import { Screen } from '@/layout/Screen';
import { Stack } from '@/layout/Stack';
import { Text } from '@/components';
import { useTheme } from '@/theme/useTheme';
import { Header } from '@/components/header/Header';

export default function AboutScreen() {
  const { theme } = useTheme();
  const c = theme.colours;

  return (
    <AppLayout safe>
      <Header />
      <Screen>
        <Stack
          gap={4}
          style={{
            paddingHorizontal: theme.spacing[4],
            paddingTop: theme.spacing[4],
            paddingBottom: theme.spacing[6],
          }}
        >
          {/* Title */}
          <Text
            style={{
              ...theme.typography.h2,
              color: c.text,
            }}
          >
            About xG Insights
          </Text>

          {/* Intro */}
          <Text style={{ ...theme.typography.body, color: c.muted }}>
            Football Boost Machine is an insights app designed to help you
            explore upcoming football fixtures using data-driven models and
            expected goals (xG).
          </Text>

          {/* Section: How it works */}
          <Section title="How predictions work">
            <Text style={{ color: c.muted }}>
              Predictions are generated using statistical models trained on
              historical match data.
            </Text>
            <Text style={{ color: c.muted }}>
              The models estimate probabilities for outcomes such as match
              winner, goals markets, and both teams to score (BTTS).
            </Text>
          </Section>

          {/* Section: Highlights */}
          <Section title="Highlighted fixtures">
            <Text style={{ color: c.muted }}>
              Some fixtures are highlighted when the model identifies a clearer
              edge than usual.
            </Text>
            <Text style={{ color: c.muted }}>
              This does not mean an outcome is guaranteed — only that confidence
              is higher relative to other matches.
            </Text>
          </Section>

          {/* Section: xG */}
          <Section title="What is xG?">
            <Text style={{ color: c.muted }}>
              Expected goals (xG) estimate the quality of chances created and
              conceded.
            </Text>
            <Text style={{ color: c.muted }}>
              Higher xG values suggest better opportunities, not guaranteed
              goals. Trends over multiple matches are usually more meaningful
              than single games.
            </Text>
          </Section>

          {/* Section: What it is not */}
          <Section title="What this app is not">
            <Text style={{ color: c.muted }}>
              Football Boost Machine does not provide betting advice or
              guaranteed predictions.
            </Text>
            <Text style={{ color: c.muted }}>
              Use these insights as one input alongside your own judgement.
            </Text>
          </Section>

          {/* Footer note */}
          <Text
            style={{
              ...theme.typography.caption,
              color: c.muted,
              marginTop: theme.spacing[4],
            }}
          >
            Built independently. Not affiliated with any leagues, clubs, or
            bookmakers.
          </Text>
        </Stack>
      </Screen>
    </AppLayout>
  );
}

/* ---------------- helpers ---------------- */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const c = theme.colours;

  return (
    <Stack gap={2} style={{ marginTop: theme.spacing[2] }}>
      <Text
        style={{
          ...theme.typography.label,
          color: c.text,
        }}
      >
        {title}
      </Text>
      {children}
    </Stack>
  );
}
