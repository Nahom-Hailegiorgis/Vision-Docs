// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Allows: import { SOME_VAR } from "@env";
      [
        "module:react-native-dotenv",
        {
          moduleName: "@env",
          path: ".env",
          safe: false, // set true if you want to ensure all vars are defined
          allowUndefined: true, // set false to throw on undefined
        },
      ],
    ],
  };
};
