import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from './Text';

describe('Text', () => {
  it('renders children', () => {
    const { getByText } = render(<Text>Hello</Text>);
    expect(getByText('Hello')).toBeTruthy();
  });
});
