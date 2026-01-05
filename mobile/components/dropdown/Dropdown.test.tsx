import React from 'react';
import { render } from '@testing-library/react-native';
import { Dropdown } from './Dropdown';

describe('Dropdown', () => {
  it('renders correctly', () => {
    const { getByTestId } = render(
      <Dropdown
        testID="dropdown"
        label="Test"
        placeholder="Placeholder"
        options={[
          { label: 'Option 1', value: '1' },
          { label: 'Option 2', value: '2' },
        ]}
        value={'2'}
        onChange={() => {}}
      />,
    );
    expect(getByTestId('dropdown')).toBeTruthy();
  });
});
