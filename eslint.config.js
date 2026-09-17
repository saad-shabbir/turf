const { defineConfig } = require("eslint/config");
const expo = require("eslint-config-expo/flat");
module.exports = defineConfig([
  expo,
  {
    ignores: [
      "node_modules/**",
      "build/**",
      "ios/**",
      "src/db/database.generated.ts",
    ],
  },
]);
