import { useTheme } from "@/theme/useTheme";
import { View } from "react-native";
import { Text } from "@/components/text/Text";
import { Row } from "@/layout/Row";
import { FixtureDetailsDoc } from "@/types";
import { computeLambdas } from "@/utils/poisson";

type xgTotalsProps = {
  fixture: FixtureDetailsDoc;
}

const XgTotals = ({fixture}: xgTotalsProps) => {
  const { theme } = useTheme();
  const c = theme.colours;
  const lambdas = computeLambdas(fixture);

  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderRadius: 16,
        padding: theme.spacing[3],
      }}
    >
      <Text
        style={{
          ...theme.typography.body,
          fontFamily: theme.fontFamilies.bold,
          color: c.text,
          marginBottom: 8,
        }}
      >
        Score outlook
      </Text>

      <Row style={{ alignItems: 'center' }}>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ ...theme.typography.caption, color: c.muted }}>
            {fixture.home.name}
          </Text>
          <Text
            style={{ ...theme.typography.h2, color: c.primary, marginTop: 2 }}
          >
            {lambdas?.home?.toFixed(2)}
          </Text>
          <Text style={{ ...theme.typography.caption, color: c.muted }}>
            expected goals
          </Text>
        </View>

        <View
          style={{
            width: 1,
            height: 46,
            backgroundColor: c.border,
            opacity: 0.7,
          }}
        />

        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ ...theme.typography.caption, color: c.muted }}>
            {fixture.away.name}
          </Text>
          <Text
            style={{ ...theme.typography.h2, color: c.text2, marginTop: 2 }}
          >
            {lambdas?.away?.toFixed(2)}
          </Text>
          <Text style={{ ...theme.typography.caption, color: c.muted }}>
            expected goals
          </Text>
        </View>
      </Row>
    </View>
  );
};

export { XgTotals }