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
    'role.subtitle': 'Book a ride or drive with Tempu in Kathmandu.',
    'role.popular': 'POPULAR',
    'role.rideTitle': 'I need a ride',
    'role.rideDesc': 'Book a tempo or scooter, offer your fare and pick a driver.',
    'role.rideCta': 'Continue as rider',
    'role.driveTitle': 'I want to drive',
    'role.driveDesc': 'Drive your tempo, scooter or delivery vehicle on your own hours.',
    'role.driveCta': 'Apply to drive',
    'role.haveAccount': 'Already have an account? ',
    'role.signIn': 'Sign in',
    'role.contact': 'Contact support',
    'lang.choose': 'Choose language',
  },
  ne: {
    'role.title': 'तपाईं टेम्पु कसरी प्रयोग गर्न चाहनुहुन्छ?',
    'role.subtitle': 'काठमाडौंमा टेम्पुबाट सवारी बुक गर्नुहोस् वा चलाउनुहोस्।',
    'role.popular': 'लोकप्रिय',
    'role.rideTitle': 'मलाई सवारी चाहियो',
    'role.rideDesc': 'टेम्पु वा स्कुटर बुक गर्नुहोस्, आफ्नो भाडा प्रस्ताव गर्नुहोस् र चालक छान्नुहोस्।',
    'role.rideCta': 'यात्रीको रूपमा जारी राख्नुहोस्',
    'role.driveTitle': 'म गाडी चलाउन चाहन्छु',
    'role.driveDesc': 'आफ्नो टेम्पु, स्कुटर वा डेलिभरी सवारी आफ्नै समयमा चलाउनुहोस्।',
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
