import { Tabs } from "expo-router";
import { useTheme } from '../../theme/useTheme'; 
import { Header } from "@/components/header/Header";
import { Text } from "@/components";

export default function TabsLayout() {
  const { theme } = useTheme();
  const colours = theme.colours;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: colours.bg,
        },
        tabBarStyle: {
          backgroundColor: colours.surface,
          borderTopColor: colours.border,
          paddingLeft: 0,
          paddingRight: 0,
        },
        tabBarItemStyle: {
          paddingHorizontal: 0,
        },

        tabBarActiveTintColor: colours.primary,
        tabBarInactiveTintColor: colours.muted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Text style={{ color, fontSize: 16 }}>🏠</Text>
          )}}
      />
    </Tabs>
  );
}
