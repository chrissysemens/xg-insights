import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Text } from '../../text/Text';

type GoalsBadgeRowProps = {
  theme: any;
  colours: any;
  prediction: any;
};
/**
 * Single goals chip, based on server-computed `goalsPick`:
 *  - never shows both BTTS + Over25
 *  - if both are "Y", server already picked the higher prob
 */
export const GoalsBadgeRow = ({
    theme,
    colours: c,
    prediction,
}: GoalsBadgeRowProps) => {
  const { t } = useTranslation();

  const serverGp = prediction?.goalsPick as
    | { kind: 'btts' | 'over25'; pick: 'Y'; prob: number }
    | null
    | undefined;

  const overY = prediction?.over25?.Y ?? 0;
  const bttsY = prediction?.btts?.Y ?? 0;
  const overOk = prediction?.over25?.pick === 'Y';
  const bttsOk = prediction?.btts?.pick === 'Y';

  const fallbackGp =
    overOk || bttsOk
      ? overOk && (!bttsOk || overY >= bttsY)
        ? { kind: 'over25' as const, pick: 'Y' as const, prob: overY }
        : { kind: 'btts' as const, pick: 'Y' as const, prob: bttsY }
      : null;

  const gp = serverGp ?? fallbackGp;
  if (!gp) return null;

  const chipStyle = {
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.radii.pill,
    backgroundColor: c.surface2,
    borderWidth: theme.components.borderWidth,
    borderColor: c.border,
  };

  return (
    <View
      style={{
        marginTop: theme.spacing[3],
        flexDirection: 'row',
        gap: theme.spacing[2],
        flexWrap: 'wrap',
      }}
    >
      <View style={chipStyle}>
        <Text style={{ ...theme.typography.caption, color: c.text2 }}>
          {gp.kind === 'over25' ? t('home.over25') : t('home.btts')}
        </Text>
      </View>
    </View>
  );
};