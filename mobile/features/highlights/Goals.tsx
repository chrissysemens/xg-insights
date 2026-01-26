import React from 'react';
import { HighlightList } from './HighLightList';

export const Goals = () => {
  return (
    <HighlightList
      tab="goals"
      titleKey="home.goalsAndBtts"
      subtitleKey="home.topPicksDescription"
      variant="goals"
      take={50}
    />
  );
};