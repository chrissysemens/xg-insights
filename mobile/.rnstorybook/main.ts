import type { StorybookConfig } from '@storybook/react-native';

const config: StorybookConfig = {
  stories: ['../components/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-ondevice'],
};

export default config;