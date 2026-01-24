import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { AppLayout } from '@/layout/AppLayout';
import { Header } from '@/components/header/Header';
import { Fixture } from '@/fetatures/fixture/Fixture';

const FixtureDetails = () => {
  console.log("Rendering FixtureDetails component");
  const { fixtureId } = useLocalSearchParams<{ fixtureId: string }>();

  return (
    <AppLayout safe>
      <Header />
      <Fixture fixtureId={fixtureId} />
    </AppLayout>
  );
}

export default FixtureDetails;