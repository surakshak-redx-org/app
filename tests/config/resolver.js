const reactNativeResolver = require('@react-native/jest-preset/jest/resolver');

/**
 * Composes two resolvers that both need to run.
 *
 * `react-native-worklets` (pulled in by Reanimated 4) resolves its `.native`
 * entry points under Jest, and those reach for a JSI runtime that does not
 * exist there. The library ships `react-native-worklets/jest/resolver.js` to
 * strip the `.native` extension, but jest-expo already installs React Native's
 * own resolver and Jest allows only one — so apply the worklets extension
 * filter here, then hand off to React Native's resolver for everything else.
 */
module.exports = (request, options) => {
  const isWorklets =
    options.basedir.includes('react-native-worklets') || request.includes('react-native-worklets');

  if (!isWorklets) {
    return reactNativeResolver(request, options);
  }

  return reactNativeResolver(request, {
    ...options,
    extensions: options.extensions?.filter((extension) => !extension.includes('native')),
  });
};
