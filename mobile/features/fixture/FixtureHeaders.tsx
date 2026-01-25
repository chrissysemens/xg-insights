import { View } from 'react-native';
import { Text } from '@/components/text/Text';
import { formatKickoff } from '@/components/cards/FixtureCard';
import { FixtureDetailsDoc } from '@/types';
import { useTheme } from '@/theme/useTheme';

type FixtureHeaderProps = {
  fixture: FixtureDetailsDoc;
};

export const FixtureHeader = ({ fixture }: FixtureHeaderProps) => {
  const { theme } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingTop: 6 }}>
      <Text
        style={{
          ...theme.typography.caption,
          color: theme.colours.text,
          marginBottom: 4,
        }}
      >
        {`${fixture.league?.name}`}
      </Text>
      <Text
        style={{
          ...theme.typography.caption,
          color: theme.colours.muted,
        }}
      >
        {`${fixture.startingAtTimestamp ? formatKickoff(fixture.startingAtTimestamp) : ''}`}
      </Text>
    </View>
  );
};
