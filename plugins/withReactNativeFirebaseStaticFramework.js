// @ts-check
/**
 * Adds `$RNFirebaseAsStaticFramework = true` to the iOS Podfile.
 *
 * Why: expo-build-properties sets `use_frameworks! :linkage => :static` (needed
 * so Firebase's Swift pods — FirebaseAuth / FirebaseFirestore / FirebaseStorage
 * / FirebaseCoreInternal — build as modular static frameworks instead of static
 * libraries, which they can't be). Under `use_frameworks!` every
 * @react-native-firebase pod's podspec checks `defined?($RNFirebaseAsStaticFramework)`
 * and falls back to `s.static_framework = false` without it, which then clashes
 * with the statically linked pods around it. The @react-native-firebase/app
 * config plugin only exposes `ios.disableSPM`, not this flag, so it's set here.
 *
 * Anchored just after `prepare_react_native_project!`, matching where the
 * @react-native-firebase/app plugin injects `$RNFirebaseDisableSPM`.
 */
const { withPodfile } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

const TAG = 'react-native-firebase-static-framework';
const FLAG = '$RNFirebaseAsStaticFramework = true';
const ANCHOR = /prepare_react_native_project!/;

/** @type {import('@expo/config-plugins').ConfigPlugin} */
const withReactNativeFirebaseStaticFramework = (config) =>
  withPodfile(config, (podfileConfig) => {
    podfileConfig.modResults.contents = mergeContents({
      src: podfileConfig.modResults.contents,
      newSrc: FLAG,
      tag: TAG,
      anchor: ANCHOR,
      offset: 1,
      comment: '#',
    }).contents;
    return podfileConfig;
  });

module.exports = withReactNativeFirebaseStaticFramework;
