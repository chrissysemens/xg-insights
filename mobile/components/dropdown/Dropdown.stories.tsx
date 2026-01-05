import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { View } from 'react-native';
import { Dropdown } from './Dropdown';

const meta: Meta<typeof Dropdown> = {
  title: 'Components/Dropdown',
  component: Dropdown,
};

export default meta;

type Story = StoryObj<typeof Dropdown>;

export const Basic: Story = {
  render: () => {
    const [league, setLeague] = useState<string | null>(null);

    return (
      <View style={{ padding: 24 }}>
        <Dropdown
          label="League"
          placeholder="Choose league"
          value={league}
          options={[
            { label: 'Premier League', value: 'epl' },
            { label: 'Serie A', value: 'sa' },
            { label: 'La Liga', value: 'll' },
          ]}
          onChange={setLeague}
        />
      </View>
    );
  },
};
