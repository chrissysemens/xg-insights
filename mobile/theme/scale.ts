import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// iPhone 11 / “normal” baseline
const BASE_WIDTH = 375;

export function scaleFont(size: number) {
  const scaled = (SCREEN_WIDTH / BASE_WIDTH) * size;
  // Round to nearest pixel for crisp text
  return Math.round(PixelRatio.roundToNearestPixel(scaled));
}
