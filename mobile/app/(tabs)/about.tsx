import React from 'react';
import { ScrollView, View } from 'react-native';
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
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing[4],
            paddingTop: theme.spacing[2],
            paddingBottom: theme.spacing[6],
            gap: theme.spacing[3],
          }}
        >
          {/* Header block */}
          <View style={{ gap: theme.spacing[1] }}>
            <Text
              style={{
                ...theme.typography.body,
                fontFamily: theme.fontFamilies.bold,
                color: c.text,
              }}
            >
              About Football Boost Machine
            </Text>
            <Text style={{ ...theme.typography.caption, color: c.muted }}>
              How the predictions and xG are intended to be used.
            </Text>
          </View>

          {/* Intro card */}
          <Card>
            <Text style={{ ...theme.typography.body, color: c.text }}>
              Football Boost Machine is an insights app designed to help you
              explore upcoming fixtures using data-driven models and expected
              goals (xG).
            </Text>
            <Text style={{ ...theme.typography.caption, color: c.muted, marginTop: 8 }}>
              Built independently. Not affiliated with any leagues, clubs, or
              bookmakers.
            </Text>
          </Card>

          <SectionCard title="How predictions work">
            <BodyLine>
              Predictions are generated using statistical models trained on
              historical match data.
            </BodyLine>
            <BodyLine>
              The models estimate probabilities for markets like match winner,
              Over 2.5, and BTTS.
            </BodyLine>
            <BodyLine>
              A “pick” is simply the highest-probability outcome, not a promise.
            </BodyLine>
          </SectionCard>

          <SectionCard title="Highlighted fixtures">
            <BodyLine>
              Some fixtures are highlighted when the model identifies a clearer
              edge than usual (higher confidence relative to other matches).
            </BodyLine>
            <BodyLine>
              This does not mean the outcome is guaranteed — variance happens.
            </BodyLine>
          </SectionCard>

          <SectionCard title="What is xG?">
            <BodyLine>
              Expected goals (xG) estimates the quality of chances created and
              conceded.
            </BodyLine>
            <BodyLine>
              Higher xG suggests better opportunities, not guaranteed goals.
            </BodyLine>
            <BodyLine>
              Trends over multiple matches are usually more meaningful than a
              single game.
            </BodyLine>
          </SectionCard>

          <SectionCard title="What this app is not">
            <BodyLine>
              Football Boost Machine does not provide betting advice or
              guaranteed predictions.
            </BodyLine>
            <BodyLine>
              Use these insights as one input alongside your own judgement.
            </BodyLine>
          </SectionCard>

          {/* Small footer note */}
          <Text
            style={{
              ...theme.typography.caption,
              color: c.muted,
              textAlign: 'center',
              marginTop: theme.spacing[2],
            }}
          >
            Data can be incomplete or delayed. Always sanity-check fixtures and
            kick-off times.
          </Text>
        </ScrollView>
      </Screen>
    </AppLayout>
  );
}

/* ---------------- helpers ---------------- */

function Card({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const c = theme.colours;

  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderRadius: 16,
        padding: theme.spacing[3],
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      {children}
    </View>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { theme } = useTheme();
  const c = theme.colours;

  return (
    <Card>
      <Text
        style={{
          ...theme.typography.label,
          fontFamily: theme.fontFamilies.bold,
          color: c.text,
          marginBottom: theme.spacing[2],
        }}
      >
        {title}
      </Text>

      <Stack gap={2}>{children}</Stack>
    </Card>
  );
}

function BodyLine({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const c = theme.colours;

  return (
    <Text style={{ ...theme.typography.body, color: c.muted, lineHeight: 20 }}>
      {children}
    </Text>
  );
}
