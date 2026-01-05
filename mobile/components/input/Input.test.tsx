import React from 'react';
import { render } from '@testing-library/react-native';
import { Input } from './Input';

describe('Input', () => {
  it('renders correctly', () => {
    const { getByTestId } = render(<Input testID="text-input" />);
    expect(getByTestId('text-input')).toBeTruthy();
  });
});
