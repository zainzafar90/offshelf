import tseslint from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";

const BLOCKS = ["if", "for", "while", "do", "try", "switch", "block-like"];
const DECLARATIONS = ["function", "class", "export", "type", "interface"];

export default tseslint.config({
  files: ["src/**/*.{ts,tsx}", "entrypoints/**/*.{ts,tsx}"],
  languageOptions: { parser: tseslint.parser },
  plugins: { "@stylistic": stylistic },
  rules: {
    "@stylistic/padding-line-between-statements": [
      "error",
      { blankLine: "always", prev: "import", next: "*" },
      { blankLine: "any", prev: "import", next: "import" },
      { blankLine: "always", prev: "*", next: DECLARATIONS },
      { blankLine: "always", prev: DECLARATIONS, next: "*" },
      { blankLine: "always", prev: "*", next: [...BLOCKS, "return"] },
      { blankLine: "always", prev: BLOCKS, next: "*" },
      { blankLine: "always", prev: ["const", "let"], next: "*" },
      { blankLine: "any", prev: ["const", "let"], next: ["const", "let"] },
    ],
  },
});
