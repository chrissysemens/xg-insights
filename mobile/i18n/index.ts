import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './languages/en.json';

const resources = {
  en: { translation: en },
} as const;

const deviceLanguage = (
  Localization.getLocales?.()[0]?.languageCode ?? 'en'
).toLowerCase();

const supported = Object.keys(resources);
const lng = supported.includes(deviceLanguage) ? deviceLanguage : 'en';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

export default i18n;
