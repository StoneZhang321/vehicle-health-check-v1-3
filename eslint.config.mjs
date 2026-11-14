/** 中文：检查正式代码和未使用路径。 English: Check current product code and unused paths. */
import parser from "@typescript-eslint/parser";
import ts from "@typescript-eslint/eslint-plugin";
export default [
  { ignores: ["dist/**", "node_modules/**", "work/**", "public/**", "src/content/**"] },
  { files: ["src/**/*.{ts,tsx}"], languageOptions: { parser, parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } } },
    plugins: { "@typescript-eslint": ts }, rules: { ...ts.configs.recommended.rules, "@typescript-eslint/no-explicit-any": "error" } }
];
