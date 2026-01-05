import { useFonts } from 'expo-font';

export function useAppFonts() {
  return useFonts({
    InterRegular: require('../assets/fonts/Inter-18pt-Regular.ttf'),
    InterMedium: require('../assets/fonts/Inter-18pt-Medium.ttf'),
    InterSemiBold: require('../assets/fonts/Inter-18pt-SemiBold.ttf'),
    InterBold: require('../assets/fonts/Inter-18pt-Bold.ttf'),
  });
}
