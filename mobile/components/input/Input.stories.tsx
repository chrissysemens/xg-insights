import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { Input } from './Input';
import { Text } from 'components/text/Text';

const meta: Meta = {
  title: 'Components/Input',
};

export default meta;
type Story = StoryObj;

export const Basic: Story = {
  render: () => (
    <View style={{ padding: 24 }}>
      <Input
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
      />
    </View>
  ),
};
