import React from 'react';
import { Flex, type FlexProps } from './Flex';

export type RowProps = Omit<FlexProps, 'direction'>;

export function Row(props: RowProps) {
  return <Flex direction="row" {...props} />;
}