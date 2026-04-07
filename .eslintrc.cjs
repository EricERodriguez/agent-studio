module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module"
  },
  ignorePatterns: ["dist", "webview-dist", "node_modules"],
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off"
      }
    }
  ]
};
