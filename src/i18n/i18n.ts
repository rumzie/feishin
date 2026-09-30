import { PostProcessorModule, ResourceLanguage } from 'i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';

const resources = {
    en: { translation: en },
};

// Locale files are code-split; only the active language is fetched at runtime.
const localeModules = import.meta.glob('./locales/*.json', { import: 'default' });

export const loadLanguage = async (language: string): Promise<void> => {
    if (!language) {
        return;
    }

    if (!i18n.hasResourceBundle(language, 'translation')) {
        const loader = localeModules[`./locales/${language}.json`];

        if (loader) {
            const bundle = (await loader()) as ResourceLanguage;
            i18n.addResourceBundle(language, 'translation', bundle);
        }
    }

    await i18n.changeLanguage(language);
};

export const languages = [
    {
        label: 'English',
        value: 'en',
    },
    {
        label: 'العربية',
        value: 'ar',
    },
    {
        label: 'Български',
        value: 'bg',
    },
    {
        label: 'Català',
        value: 'ca',
    },
    {
        label: 'Čeština',
        value: 'cs',
    },
    {
        label: 'Dansk',
        value: 'da',
    },
    {
        label: 'Deutsch',
        value: 'de',
    },
    {
        label: 'Español',
        value: 'es',
    },
    {
        label: 'Eesti',
        value: 'et',
    },
    {
        label: 'Basque',
        value: 'eu',
    },
    {
        label: 'Français',
        value: 'fr',
    },
    {
        label: 'Galego',
        value: 'gl',
    },
    {
        label: 'Bahasa Indonesia',
        value: 'id',
    },
    {
        label: 'Suomeksi',
        value: 'fi',
    },
    {
        label: 'Magyar',
        value: 'hu',
    },
    {
        label: 'Italiano',
        value: 'it',
    },
    {
        label: '日本語',
        value: 'ja',
    },
    {
        label: '한국어',
        value: 'ko',
    },
    {
        label: 'Latviešu',
        value: 'lv',
    },
    {
        label: 'Nederlands',
        value: 'nl',
    },
    {
        label: 'Norsk (Bokmål)',
        value: 'nb-NO',
    },
    {
        label: 'Norsk (Nynorsk)',
        value: 'nn',
    },
    {
        label: 'فارسی',
        value: 'fa',
    },
    {
        label: 'Português',
        value: 'pt',
    },
    {
        label: 'Português (Brasil)',
        value: 'pt-BR',
    },
    {
        label: 'Polski',
        value: 'pl',
    },
    {
        label: 'Română',
        value: 'ro',
    },
    {
        label: 'Русский',
        value: 'ru',
    },
    {
        label: 'Slovenčina',
        value: 'sk',
    },
    {
        label: 'Slovenščina',
        value: 'sl',
    },
    {
        label: 'Srpski',
        value: 'sr',
    },
    {
        label: 'Svenska',
        value: 'sv',
    },
    {
        label: 'Tamil',
        value: 'ta',
    },
    {
        label: 'Thai',
        value: 'th',
    },
    {
        label: 'Tagalog',
        value: 'tl',
    },
    {
        label: 'Türkçe',
        value: 'tr',
    },
    {
        label: 'Українська',
        value: 'uk',
    },
    {
        label: '简体中文',
        value: 'zh-Hans',
    },
    {
        label: '繁體中文',
        value: 'zh-Hant',
    },
];

const lowerCasePostProcessor: PostProcessorModule = {
    name: 'lowerCase',
    process: (value: string) => {
        return value.toLocaleLowerCase();
    },
    type: 'postProcessor',
};

const upperCasePostProcessor: PostProcessorModule = {
    name: 'upperCase',
    process: (value: string) => {
        return value.toLocaleUpperCase();
    },
    type: 'postProcessor',
};

const titleCasePostProcessor: PostProcessorModule = {
    name: 'titleCase',
    process: (value: string) => {
        return value.replace(/\S\S*/g, (txt) => {
            return txt.charAt(0).toLocaleUpperCase() + txt.slice(1).toLowerCase();
        });
    },
    type: 'postProcessor',
};

// const ignoreSentenceCaseLanguages = ['de'];

const sentenceCasePostProcessor: PostProcessorModule = {
    name: 'sentenceCase',
    process: (value: string) => {
        const sentences = value.split('. ');

        return sentences
            .map((sentence) => {
                return (
                    sentence.charAt(0).toLocaleUpperCase() + sentence.slice(1).toLocaleLowerCase()
                );
            })
            .join('. ');
    },
    type: 'postProcessor',
};
i18n.use(lowerCasePostProcessor)
    .use(upperCasePostProcessor)
    .use(titleCasePostProcessor)
    .use(sentenceCasePostProcessor)
    .use(initReactI18next) // passes i18n down to react-i18next
    .init({
        fallbackLng: 'en',
        // language to use, more information here: https://www.i18next.com/overview/configuration-options#languages-namespaces-resources
        // you can use the i18n.changeLanguage function to change the language manually: https://www.i18next.com/overview/api#changelanguage
        // if you're using a language detector, do not define the lng option
        interpolation: {
            escapeValue: false, // react already safes from xss
        },
        resources,
    });

export default i18n;
