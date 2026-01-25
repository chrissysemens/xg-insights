import { View } from "react-native";
import { Text } from "../../components/text/Text";
import { useTheme } from "@/theme/useTheme";

const WarningBadge = ({ label }: { label: string }) => {
      const { theme } = useTheme();
      const c = theme.colours;

    return (
      <View
        style={{
          backgroundColor: (c as any).warningSoft ?? c.surface2,
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderWidth: 1,
          borderColor: (c as any).warningSoft ?? c.border,
        }}
      >
        <Text
          style={{
            ...theme.typography.caption,
            color: (c as any).warning ?? c.text,
          }}
        >
          {label}
        </Text>
      </View>
    );
  };

  export { WarningBadge };