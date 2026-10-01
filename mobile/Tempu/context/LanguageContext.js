import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

// App language (English / Nepali). The choice is remembered across launches.
// Screens read strings with `const { t } = useLanguage(); t('role.title')`;
// a key missing from Nepali falls back to English, and a key missing from
// both shows the key itself so the gap is visible instead of blank.
const STORE_KEY = 'tempu_language';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ne', label: 'नेपाली' },
];

const STRINGS = {
  en: {
    'role.title': 'How would you like to use Tempu?',
    'role.subtitle': "Join Nepal's smartest urban transport ecosystem.",
    'role.popular': 'POPULAR',
    'role.rideTitle': 'I need a ride',
    'role.rideDesc': 'Request a safe, fast trip through the city with vetted local drivers.',
    'role.rideCta': 'Get Started as Rider',
    'role.driveTitle': 'I want to drive',
    'role.driveDesc': 'Earn more on your own schedule. Join our fleet of electric and eco-friendly vehicles.',
    'role.driveCta': 'Apply to Drive',
    'role.haveAccount': 'Already have an account? ',
    'role.signIn': 'Sign in',
    'role.contact': 'Contact support',
    'lang.choose': 'Choose language',
  },
  ne: {
    'role.title': 'तपाईं टेम्पु कसरी प्रयोग गर्न चाहनुहुन्छ?',
    'role.subtitle': 'नेपालको सबैभन्दा स्मार्ट सहरी यातायात प्रणालीमा सामेल हुनुहोस्।',
    'role.popular': 'लोकप्रिय',
    'role.rideTitle': 'मलाई सवारी चाहियो',
    'role.rideDesc': 'प्रमाणित स्थानीय चालकहरूसँग सहरभित्र सुरक्षित र छिटो यात्रा गर्नुहोस्।',
    'role.rideCta': 'यात्रीको रूपमा सुरु गर्नुहोस्',
    'role.driveTitle': 'म गाडी चलाउन चाहन्छु',
    'role.driveDesc': 'आफ्नै समयमा बढी कमाउनुहोस्। हाम्रो विद्युतीय र वातावरणमैत्री सवारी टोलीमा सामेल हुनुहोस्।',
    'role.driveCta': 'चालकको लागि आवेदन दिनुहोस्',
    'role.haveAccount': 'पहिले नै खाता छ? ',
    'role.signIn': 'साइन इन',
    'role.contact': 'सहायता सम्पर्क',
    'lang.choose': 'भाषा छान्नुहोस्',
  },
};

const LanguageContext = createContext({ lang: 'en', setLang: () => {}, t: (k) => STRINGS.en[k] ?? k });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('en');

  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY)
      .then((v) => { if (v && STRINGS[v]) setLangState(v); })
      .catch(() => {});
  }, []);

  const setLang = useCallback((code) => {
    if (!STRINGS[code]) return;
    setLangState(code);
    AsyncStorage.setItem(STORE_KEY, code).catch(() => {});
  }, []);

  const t = useCallback((key) => STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key, [lang]);

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
