import React from 'react';
import { Flex, type FlexProps } from './Flex';

export type StackProps = Omit<FlexProps, 'direction'>;

/**
 * Stack wapper component for vertical layout
 * @param props - Stack props
 * @returns - Stack component
 */
export const Stack = (props: StackProps) => {
  return <Flex direction="column" {...props} />;
};
