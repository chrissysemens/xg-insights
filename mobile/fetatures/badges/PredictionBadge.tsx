import { useTheme } from "@/theme/useTheme";
import { View } from "react-native";
import { Text } from "../../components/text/Text";

const PredictionBadge = ({
  label,
  highlighted,
}: {
  label: string;
  highlighted?: boolean;
}) => {
  const { theme } = useTheme();
  const c = theme.colours;

  return (
    <View
      style={{
        backgroundColor: highlighted ? c.primarySoft : c.surface2,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Text style={{ ...theme.typography.caption, color: c.muted }}>
        {label}
      </Text>
    </View>
  );
};

export { PredictionBadge}
