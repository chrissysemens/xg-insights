import { ResultPick } from "@/types";
import { View, Image } from "react-native";
import { Text } from "../../text/Text";
import { teamStyle } from "@/utils/highlight-reason";

type TeamsRowProps = {
  theme: any;
  colours: any;
  homeName: string;
  awayName: string;
  homeImage?: string | null;
  awayImage?: string | null;
  pick?: ResultPick;
  winnerColourEnabled?: boolean;
};

export const TeamsRow = ({
theme,
  colours: c,
  homeName,
  awayName,
  homeImage,
  awayImage,
  pick,
  winnerColourEnabled = true,
}: TeamsRowProps) => {
  const isHomePick = pick === 'H';
  const isAwayPick = pick === 'A';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: theme.spacing[3],
        gap: theme.spacing[3],
      }}
    >
      {/* HOME */}
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          minWidth: 0,
        }}
      >
        {!!homeImage && (
          <Image
            source={{ uri: homeImage }}
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              marginRight: theme.spacing[2],
            }}
          />
        )}
        <Text
          numberOfLines={1}
          style={{
            ...theme.typography.body,
            ...(winnerColourEnabled
              ? teamStyle('home', pick, c)
              : { color: c.text }),
            fontFamily: isHomePick
              ? theme.fontFamilies.bold
              : theme.fontFamilies.regular,
            flexShrink: 1,
          }}
        >
          {homeName}
        </Text>
      </View>

      {/* VS */}
      <Text style={{ ...theme.typography.caption, color: c.muted }}>vs</Text>

      {/* AWAY */}
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          minWidth: 0,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            ...theme.typography.body,
            ...(winnerColourEnabled
              ? teamStyle('away', pick, c)
              : { color: c.text }),
            fontFamily: isAwayPick
              ? theme.fontFamilies.bold
              : theme.fontFamilies.regular,
            flexShrink: 1,
            textAlign: 'right',
          }}
        >
          {awayName}
        </Text>
        {!!awayImage && (
          <Image
            source={{ uri: awayImage }}
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              marginLeft: theme.spacing[2],
            }}
          />
        )}
      </View>
    </View>
  );
};