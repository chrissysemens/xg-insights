import React from 'react';
import { render } from '@testing-library/react-native';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('renders correctly', () => {
    const { getByTestId } = render(<Spinner size="sm" />);
    expect(getByTestId('spinner')).toBeTruthy();
  });
});
