import { Image, Pressable } from "react-native";
import { Row } from "@/layout/Row";
import { Text } from "@/components";
import { useTheme } from "@/theme/useTheme";
import { useAppStore } from "@/state/useAppStore"; // adjust path

const nextMode = {
  system: "light",
  light: "dark",
  dark: "system",
} as const;

const Header = () => {
  const { theme } = useTheme();
  const c = theme.colours;

  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);

  return (
    <Row
      align="center"
      justify="space-between"
      style={{
        paddingVertical: theme.spacing[3],
        paddingHorizontal: theme.spacing[4],
      }}
    >
      {/* Left: Logo + title */}
      <Row align="center" style={{ gap: theme.spacing[3] }}>
        <Image
          source={require("@/assets/icon.png")}
          style={{ width: 28, height: 28 }}
          resizeMode="contain"
        />
        <Text
          style={{
            fontSize: 20,
            fontWeight: "700",
            color: c.text,
          }}
        >
          xG Insights
        </Text>
      </Row>

      {/* Right: Theme switcher */}
      <Pressable
        onPress={() => setThemeMode(nextMode[themeMode])}
        style={{
          paddingHorizontal: theme.spacing[3],
          paddingVertical: theme.spacing[2],
          borderRadius: 999,
          backgroundColor: c.surface2,
          borderWidth: 1,
          borderColor: c.border,
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: "600",
            color: c.text2,
          }}
        >
          {themeMode.toUpperCase()}
        </Text>
      </Pressable>
    </Row>
  );
};

export { Header };
