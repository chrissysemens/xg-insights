import React from 'react';
import { render } from '@testing-library/react-native';
import { Button } from './Button';

describe('Button', () => {
  it('renders correctly', () => {
    const { getByTestId } = render(
      <Button testID="button" text="Test" onPress={() => {}} />,
    );
    expect(getByTestId('button')).toBeTruthy();
  });
});
