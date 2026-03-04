import { getResultConf, roundToNearest25 } from "@/utils/highlight-reason";
import { useTranslation } from "react-i18next";
import { Text } from "../../text/Text";

type ConfidenceRowProps = {
  theme: any;
  colours: any;
  prediction: any;
};

export const ConfidenceRow = ({
  theme,
  colours: c,
  prediction,
}: ConfidenceRowProps) => {
  const { t } = useTranslation();
  const conf = roundToNearest25(getResultConf(prediction) * 100);

  return (
    <Text
      style={{
        marginTop: theme.spacing[2],
        marginLeft: theme.spacing[1],
        ...theme.typography.caption,
        fontFamily: theme.fontFamilies.bold,
        color: c.primary,
      }}
    >
      {t('home.resultConfidence', { conf })}
    </Text>
  );
};