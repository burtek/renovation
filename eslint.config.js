import { prepareConfig } from '@dtrw/eslint-config';


const config = [
    ...prepareConfig({ react: true }),
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parserOptions: {
                project: ['./tsconfig.json', './tsconfig.node.json'],
                tsconfigRootDir: import.meta.dirname
            }
        }
    },
    {
        // Ban direct imports from vitest — globals are provided via tsconfig types (vitest/globals)
        files: ['**/*.test.{ts,tsx}', 'src/test-setup.ts'],
        rules: { 'no-restricted-imports': ['error', { name: 'vitest', message: "Import vitest globals via tsconfig 'types' instead." }] }
    },
    {
        // Relax rules that are too strict or inapplicable in test files
        files: ['**/*.test.{ts,tsx}', 'src/test-setup.ts'],
        rules: {
            // Numbers / assertions
            '@typescript-eslint/no-magic-numbers': 'off',
            '@typescript-eslint/no-non-null-assertion': 'off',
            '@typescript-eslint/no-unsafe-type-assertion': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/require-await': 'off',
            // Necessary in vi.mock() factory: PascalCase component names,
            // components defined inside the factory, empty stub functions
            '@typescript-eslint/naming-convention': 'off',
            '@eslint-react/component-hook-factories': 'off',
            '@typescript-eslint/no-empty-function': 'off',
            // Test values can be literals; no-unnecessary-condition is noisy
            '@typescript-eslint/no-unnecessary-condition': 'off',
            '@typescript-eslint/no-unnecessary-type-conversion': 'off',
            // Unsafe URL strings used to test safeUrl validation
            'no-script-url': 'off',
            // Promise executor returns are used for fake async control in tests
            'no-promise-executor-return': 'off',
            // Prefer-destructuring is overly strict in test assertion lines
            '@typescript-eslint/prefer-destructuring': 'off',
            // FileReader mock needs flexible member ordering
            '@typescript-eslint/member-ordering': 'off',
            // void returns from event-handler arrow functions in JSX
            '@typescript-eslint/no-confusing-void-expression': 'off'
        }
    }
];

export default config;
