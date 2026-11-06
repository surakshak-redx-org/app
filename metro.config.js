const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { withNativeWind } = require('nativewind/metro');

// getSentryExpoConfig wraps Expo's default Metro config and injects a Debug ID
// into every bundle. Sentry matches uploaded source maps to events by that ID
// (not by release), which is what lets OTA updates be symbolicated.
const config = getSentryExpoConfig(__dirname);

module.exports = withNativeWind(config, { input: './src/global.css' });
