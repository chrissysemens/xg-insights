import React from 'react';
import { HighlightList } from './HighLightList';

export const Interesting = () => {
  return (
    <HighlightList
      tab="interesting"
      titleKey="home.interesting"
      subtitleKey="home.topPicksDescription"
      variant="interesting"
      take={50}
    />
  );
};
