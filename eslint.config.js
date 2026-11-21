import globals from "globals";

export default [
  {
    files: ["js/**/*.js", "version.js", "tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "caughtErrors": "none" }],
      "no-unreachable": "error",
      "no-dupe-keys": "error",
      "no-duplicate-imports": "error",
      "eqeqeq": ["warn", "always", { "null": "ignore" }]
    }
  }
];
