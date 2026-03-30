import { prepareConfig } from '@dtrw/eslint-config';


const config = [
    ...prepareConfig({ react: true }),
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parserOptions: {
                project: true,
                tsconfigRootDir: import.meta.dirname
            }
        }
    }
];

export default config;
