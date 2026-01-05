import React from 'react';
import { render } from '@testing-library/react-native';
import { Card } from './Card';

describe('Card', () => {
  it('renders correctly', () => {
    const { getByTestId } = render(<Card testID="card">Content</Card>);
    expect(getByTestId('card')).toBeTruthy();
  });
});
