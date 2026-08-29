import type { Config } from 'tailwindcss';
import base from '../../../../tailwind.config';

const config: Config = {
  ...base,
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    './lib/pos/__tests__/**/*.{ts,tsx}',
  ],
};

export default config;
