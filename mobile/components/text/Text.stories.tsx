import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { Text } from './Text';

const meta: Meta = {
  title: 'Components/Text',
};

export default meta;
type Story = StoryObj;

export const Basic: Story = {
  render: () => (
    <View style={{ padding: 24 }}>
      <Text>Hello from Storybook</Text>
    </View>
  ),
};
