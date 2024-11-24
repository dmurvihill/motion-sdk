// @ts-check

import tseslint from "typescript-eslint";
import eslint from "@eslint/js";
import jest from "eslint-plugin-jest";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["dist/**", "coverage/**"],
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.js", "*.cjs", "*.mjs"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["__tests__"],
    plugins: {
      jest: jest,
    },
    ...jest.configs["flat/recommended"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
);
