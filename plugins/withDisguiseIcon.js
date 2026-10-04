// @ts-check
/**
 * Registers the "Calculator" launcher icon used by Disguise Mode (BUG-014).
 *
 * Android: the MAIN/LAUNCHER intent filter moves off `.MainActivity` onto two
 * `activity-alias` launchers — `<package>.DefaultLauncher` (enabled) and
 * `<package>.CalculatorLauncher` (disabled, calculator icon, "Calculator"
 * label). `setAppIcon` in `modules/surakshak-native` flips which one is
 * enabled. The calculator mipmaps are copied into `res/mipmap-*`.
 *
 * iOS: the calculator PNGs are added to the app target's resources and
 * declared under `CFBundleAlternateIcons` as "Calculator", for
 * `setAlternateIconName`.
 *
 * Icon sources are pre-rendered in `assets/disguise/` (EAS's Linux builders
 * have no image tooling to resize at prebuild time).
 */
const fs = require('fs');
const path = require('path');

const {
  AndroidConfig,
  IOSConfig,
  withAndroidManifest,
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
} = require('@expo/config-plugins');

const DEFAULT_ALIAS = 'DefaultLauncher';
const CALCULATOR_ALIAS = 'CalculatorLauncher';
const CALCULATOR_LABEL = 'Calculator';
const ANDROID_ICON = 'ic_launcher_calculator';
const ANDROID_DENSITIES = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
const IOS_ICON_NAME = 'Calculator';
const IOS_ICON_FILES = [
  'CalculatorIcon@2x.png',
  'CalculatorIcon@3x.png',
  'CalculatorIcon@2x~ipad.png',
  'CalculatorIcon-83.5@2x~ipad.png',
];
const IOS_ICON_DIR = 'DisguiseIcons';

const sourceDir = (projectRoot, platform) => path.join(projectRoot, 'assets', 'disguise', platform);

/** @param {any} filter */
function isLauncherFilter(filter) {
  const actions = filter.action ?? [];
  const categories = filter.category ?? [];
  return (
    actions.some((a) => a.$['android:name'] === 'android.intent.action.MAIN') &&
    categories.some((c) => c.$['android:name'] === 'android.intent.category.LAUNCHER')
  );
}

function launcherAlias(name, enabled, icon, roundIcon, label) {
  return {
    $: {
      'android:name': name,
      'android:enabled': String(enabled),
      'android:exported': 'true',
      'android:targetActivity': '.MainActivity',
      'android:icon': icon,
      'android:roundIcon': roundIcon,
      'android:label': label,
    },
    'intent-filter': [
      {
        action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
        category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
      },
    ],
  };
}

/** @type {import('@expo/config-plugins').ConfigPlugin} */
const withAndroidLaunchers = (config) =>
  withAndroidManifest(config, (manifestConfig) => {
    const pkg = manifestConfig.android?.package;
    if (pkg === undefined) throw new Error('withDisguiseIcon: android.package is required');

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifestConfig.modResults);
    const main = (app.activity ?? []).find((a) => a.$['android:name'] === '.MainActivity');
    if (main === undefined) throw new Error('withDisguiseIcon: .MainActivity not found');

    main['intent-filter'] = (main['intent-filter'] ?? []).filter((f) => !isLauncherFilter(f));

    const defaultName = `${pkg}.${DEFAULT_ALIAS}`;
    const calculatorName = `${pkg}.${CALCULATOR_ALIAS}`;
    const others = (app['activity-alias'] ?? []).filter(
      (a) => a.$['android:name'] !== defaultName && a.$['android:name'] !== calculatorName,
    );
    app['activity-alias'] = [
      ...others,
      launcherAlias(
        defaultName,
        true,
        '@mipmap/ic_launcher',
        '@mipmap/ic_launcher_round',
        '@string/app_name',
      ),
      launcherAlias(
        calculatorName,
        false,
        `@mipmap/${ANDROID_ICON}`,
        `@mipmap/${ANDROID_ICON}`,
        CALCULATOR_LABEL,
      ),
    ];
    return manifestConfig;
  });

/** @type {import('@expo/config-plugins').ConfigPlugin} */
const withAndroidIcons = (config) =>
  withDangerousMod(config, [
    'android',
    (modConfig) => {
      const resDir = path.join(modConfig.modRequest.platformProjectRoot, 'app/src/main/res');
      for (const density of ANDROID_DENSITIES) {
        const target = path.join(resDir, `mipmap-${density}`);
        fs.mkdirSync(target, { recursive: true });
        fs.copyFileSync(
          path.join(
            sourceDir(modConfig.modRequest.projectRoot, 'android'),
            `${ANDROID_ICON}-${density}.png`,
          ),
          path.join(target, `${ANDROID_ICON}.png`),
        );
      }
      return modConfig;
    },
  ]);

/** @type {import('@expo/config-plugins').ConfigPlugin} */
const withIosIconFiles = (config) =>
  withDangerousMod(config, [
    'ios',
    (modConfig) => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(modConfig.modRequest.projectRoot);
      const target = path.join(modConfig.modRequest.platformProjectRoot, projectName, IOS_ICON_DIR);
      fs.mkdirSync(target, { recursive: true });
      for (const file of IOS_ICON_FILES) {
        fs.copyFileSync(
          path.join(sourceDir(modConfig.modRequest.projectRoot, 'ios'), file),
          path.join(target, file),
        );
      }
      return modConfig;
    },
  ]);

/** @type {import('@expo/config-plugins').ConfigPlugin} */
const withIosIconResources = (config) =>
  withXcodeProject(config, (xcodeConfig) => {
    const project = xcodeConfig.modResults;
    const projectName = IOSConfig.XcodeUtils.getProjectName(xcodeConfig.modRequest.projectRoot);
    for (const file of IOS_ICON_FILES) {
      const filepath = `${projectName}/${IOS_ICON_DIR}/${file}`;
      if (project.hasFile(filepath)) continue;
      IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath,
        groupName: projectName,
        project,
        isBuildFile: true,
        verbose: false,
      });
    }
    return xcodeConfig;
  });

/** @type {import('@expo/config-plugins').ConfigPlugin} */
const withIosAlternateIcon = (config) =>
  withInfoPlist(config, (plistConfig) => {
    const plist = plistConfig.modResults;
    const alternate = (files) => ({
      [IOS_ICON_NAME]: { CFBundleIconFiles: files, UIPrerenderedIcon: false },
    });
    plist.CFBundleIcons = {
      ...(plist.CFBundleIcons ?? {}),
      CFBundleAlternateIcons: alternate(['CalculatorIcon']),
    };
    plist['CFBundleIcons~ipad'] = {
      ...(plist['CFBundleIcons~ipad'] ?? {}),
      CFBundleAlternateIcons: alternate(['CalculatorIcon', 'CalculatorIcon-83.5']),
    };
    return plistConfig;
  });

/** @type {import('@expo/config-plugins').ConfigPlugin} */
const withDisguiseIcon = (config) =>
  withIosAlternateIcon(
    withIosIconResources(withIosIconFiles(withAndroidIcons(withAndroidLaunchers(config)))),
  );

module.exports = withDisguiseIcon;
