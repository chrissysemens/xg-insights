import React from 'react';
import { HighlightList } from './HighLightList';

export const Picks = () => {
  return (
    <HighlightList
      tab="winners"
      titleKey="home.matchWinners"
      subtitleKey="home.topPicksDescription"
      variant="winner"
      take={50}
    />
  );
};