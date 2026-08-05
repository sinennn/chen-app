import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    appleTeamId: process.env.APPLE_TEAM_ID,
    bundleIdentifier: process.env.IOS_BUNDLE_ID,
    googleServicesFile: process.env.IOS_GOOGLE_SERVICES_FILE,
  },
  android: {
    ...config.android,
    package: process.env.ANDROID_PACKAGE,
  },
  extra: {
    ...config.extra,
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
});
