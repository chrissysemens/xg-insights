import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { Button } from './Button';

const meta: Meta = {
  title: 'Components/Button',
};

export default meta;
type Story = StoryObj;

export const Basic: Story = {
  render: () => (
    <View style={{ padding: 24 }}>
      <Button
        text={'Click me!'}
        onPress={() => console.log('Hello')}
        loading={false}
      />
    </View>
  ),
};
