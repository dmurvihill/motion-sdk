// @ts-check

import tseslint from 'typescript-eslint';
import eslint from "@eslint/js";
import jest from "eslint-plugin-jest";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [ 'dist/**' ],
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [ '*.js', '*.cjs', '*.mjs' ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: [ "**/*.js", "**/*.cjs", "**/*.mjs" ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: [ "__tests__" ],
    plugins: {
      jest: jest,
    },
    // eslint-plugin-jest has no types yet.
    // Re-enable no-unsafe-argument when they are released.
    // https://github.com/jest-community/eslint-plugin-jest/issues/1469
    /* eslint @typescript-eslint/no-unsafe-argument: "off" */
    ...jest.configs['flat/recommended'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
);
