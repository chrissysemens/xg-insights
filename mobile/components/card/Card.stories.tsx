import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { Card } from './Card';
import { Text } from 'components/text/Text';

const meta: Meta = {
  title: 'Components/Card',
};

export default meta;
type Story = StoryObj;

export const Basic: Story = {
  render: () => (
    <View style={{ padding: 24 }}>
      <Card>
        <View>
          <Text variant="caption">Content</Text>
        </View>
      </Card>
    </View>
  ),
};
