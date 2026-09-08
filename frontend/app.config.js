const appJson = require('./app.json');

const baseUrl = process.env.EXPO_PUBLIC_WEB_BASE_PATH || '';

module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    experiments: {
      ...appJson.expo.experiments,
      baseUrl,
    },
  },
};