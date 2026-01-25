import { useTheme } from '@/theme/useTheme';
import { Result } from '@/types';
import { View } from 'react-native';
import { Text } from '../../components/text/Text';

type FormBadgeProps = {
  result: Result;
};

const FormBadge = ({ result }: FormBadgeProps) => {
  const { theme } = useTheme();
  const backgroundColor =
    result === 'W' ? '#4CAF50' : result === 'D' ? '#FFC107' : '#F44336';

  return (
    <View
      style={{
        backgroundColor,
        minWidth: 20,
        borderRadius: 4,
        paddingHorizontal: 2,
        paddingVertical: 2,
        marginRight: 4,
        alignItems: 'center',
      }}
    >
      <Text style={theme.typography.caption}>{result}</Text>
    </View>
  );
};

export { FormBadge };
