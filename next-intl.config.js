module.exports = {
  // A list of all locales that are supported
  locales: ['en', 'uk', 'ru'],

  // Used when no locale matches
  defaultLocale: 'en',

  // Path where the translation files are located
  messages: {
    en: () => import('./locales/en/common.json'),
    uk: () => import('./locales/uk/common.json'),
    ru: () => import('./locales/ru/common.json'),
  },
};
