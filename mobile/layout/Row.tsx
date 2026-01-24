import React from 'react';
import { Flex, type FlexProps } from './Flex';

export type RowProps = Omit<FlexProps, 'direction'>;

/**
 * Row: for positioning horizontally
 * @param props - Row props
 * @returns 
 */
export const Row = (props: RowProps) => {
  return <Flex direction="row" {...props} />;
}