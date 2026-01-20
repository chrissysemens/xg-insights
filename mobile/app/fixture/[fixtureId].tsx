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
import { friendlyDate } from '@/utils/dates';

const getFixtureDetails = async (fixtureId: string) => {
  const snap = await getDoc(doc(db, 'fixture_details', fixtureId));
  if (!snap.exists()) return null;
  return snap.data() as FixtureDetailsDoc;
};

const FixtureDetails = () => {
  const { fixtureId } = useLocalSearchParams<{ fixtureId: string }>();
  const { theme } = useTheme();

  const { data, isFetching } = useQuery({
    queryKey: ['fixtureDetails', fixtureId],
    enabled: !!fixtureId,
    queryFn: () => getFixtureDetails(fixtureId!),
  });

  console.log('FixtureDetails render', { fixtureId, data, isFetching });

  if (isFetching || !data) {
    return (
      <AppLayout>
        <Header />
        <Screen>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <Text
              style={{ ...theme.typography.body, color: theme.colours.muted }}
            >
              Loading…
            </Text>
          </ScrollView>
        </Screen>
      </AppLayout>
    );
  }

  const homeImg = data.home?.imagePath;
  const awayImg = data.away?.imagePath;

  return (
    <AppLayout>
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
                {`${data.startingAtTimestamp ? friendlyDate(data.startingAtTimestamp) : ''}`}
              </Text>
            </View>
          ) : null}
          <Stack gap={5} fullWidth>
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
                    color: theme.colours.muted,
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

            <Row gap={0}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ ...theme.typography.h3, textAlign: 'center' }}>
                  {data.home.name}
                </Text>
              </View>

              <View style={{ flex: 1 }} />

              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ ...theme.typography.h3, textAlign: 'center' }}>
                  {data.away.name}
                </Text>
              </View>
            </Row>

            {data.form?.homeLast5?.length || data.form?.awayLast5?.length ? (
              <Row>
                <View
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {data.form?.homeLast5
                    ? data.form.homeLast5.map((fl: FormLetter, i: number) => (
                        <FormBadge key={i} formLetter={fl} />
                      ))
                    : null}
                </View>
                <View style={{ flex: 1 }} />
                <View
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {data.form?.awayLast5
                    ? data.form.awayLast5.map((fl: FormLetter, i: number) => (
                        <FormBadge key={i} formLetter={fl} />
                      ))
                    : null}
                </View>
              </Row>
            ) : null}
          </Stack>
        </ScrollView>
      </Screen>
    </AppLayout>
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
        backgroundColor: backgroundColor,
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

export default FixtureDetails;
