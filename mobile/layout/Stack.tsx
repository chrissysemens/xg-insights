import React from 'react';
import { Flex, type FlexProps } from './Flex';

export type StackProps = Omit<FlexProps, 'direction'>;

export function Stack(props: StackProps) {
  return <Flex direction="column" {...props} />;
}