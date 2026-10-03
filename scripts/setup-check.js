#!/usr/bin/env node

/**
 * Surakshak Setup Validation Script
 * Verifies local development prerequisites, environment variables,
 * Android SDK, Java, and device connectivity.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

let totalChecks = 0;
let passedChecks = 0;
let warnings = 0;
let failures = 0;

function pass(name, detail = '') {
  totalChecks++;
  passedChecks++;
  console.log(`  \x1b[32m✓\x1b[0m ${name}${detail ? ` \x1b[90m(${detail})\x1b[0m` : ''}`);
}

function warn(name, tip = '') {
  totalChecks++;
  warnings++;
  console.log(`  \x1b[33m!\x1b[0m ${name}`);
  if (tip) {
    console.log(`    \x1b[33m→ Tip:\x1b[0m ${tip}`);
  }
}

function fail(name, fix = '') {
  totalChecks++;
  failures++;
  console.log(`  \x1b[31m✗\x1b[0m ${name}`);
  if (fix) {
    console.log(`    \x1b[31m→ Fix:\x1b[0m ${fix}`);
  }
}

function runCmd(cmd) {
  try {
    return execSync(cmd, { stdio: ['pipe', 'pipe', 'ignore'], encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

console.log('\n\x1b[1m🔍 Checking Surakshak Development Environment...\x1b[0m\n');

// 1. Node.js Version Check
const nodeVer = process.versions.node;
const majorNode = parseInt(nodeVer.split('.')[0], 10);
if (majorNode >= 20) {
  pass('Node.js', `v${nodeVer} - compatible >= 20.x, recommended 22.x LTS`);
} else {
  fail(
    `Node.js version v${nodeVer} is unsupported`,
    'Install Node.js 22 LTS from https://nodejs.org or via nvm/nvm-windows',
  );
}

// 2. Package Manager (Yarn)
const yarnVer = runCmd('yarn --version');
if (yarnVer && yarnVer.startsWith('4.')) {
  pass('Package Manager (Yarn)', `v${yarnVer}`);
} else if (yarnVer) {
  warn(
    `Yarn version is v${yarnVer} (Repo expects Yarn 4.18.0 via Corepack)`,
    'Run `corepack enable` in PowerShell as Administrator to activate the Yarn 4 shim.',
  );
} else {
  fail(
    'Yarn is not installed or not found in PATH',
    'Run `corepack enable` in PowerShell as Administrator',
  );
}

// 3. Java JDK Version Check
let javaVerStr = '';
try {
  // Note: java -version writes to stderr by design on all platforms
  const res = execSync('java -version 2>&1', {
    encoding: 'utf-8',
    shell: true,
  });
  javaVerStr = res;
} catch (err) {
  javaVerStr = (err.stderr || err.stdout || '').toString();
}

let javaMajor = null;
const javaMatch = javaVerStr.match(/version\s+"(\d+)(?:\.(\d+))?/i);
if (javaMatch) {
  javaMajor = parseInt(javaMatch[1], 10);
  if (javaMajor === 1 && javaMatch[2]) {
    javaMajor = parseInt(javaMatch[2], 10);
  }
}

// Check android/gradle.properties for custom org.gradle.java.home
let gradleJavaHome = null;
const gradlePropsPath = path.join(ROOT_DIR, 'android', 'gradle.properties');
if (fs.existsSync(gradlePropsPath)) {
  const content = fs.readFileSync(gradlePropsPath, 'utf-8');
  const match = content.match(/org\.gradle\.java\.home\s*=\s*([^\r\n]+)/);
  if (match) {
    gradleJavaHome = match[1].trim();
  }
}

if (javaMajor === 21) {
  pass('Java JDK', `JDK ${javaMajor} detected (Supported: JDK 21 for Gradle 9.3.1)`);
} else if (javaMajor === 17) {
  pass('Java JDK', `JDK ${javaMajor} detected (Supported, but JDK 21 is recommended)`);
} else if (javaMajor) {
  warn(
    `Java JDK ${javaMajor} detected`,
    'Gradle 9.3.1 in this project requires JDK 17 to 21 (JDK 21 Temurin recommended).',
  );
} else {
  fail(
    'Java (JDK) not found in PATH',
    'Install Eclipse Adoptium Temurin JDK 21 and set JAVA_HOME.',
  );
}

if (gradleJavaHome && !fs.existsSync(gradleJavaHome)) {
  warn(
    `android/gradle.properties has hardcoded org.gradle.java.home that does not exist locally`,
    `Path "${gradleJavaHome}" not found on your machine. Update or comment out org.gradle.java.home in android/gradle.properties if Gradle fails to find Java.`,
  );
}

// 4. Android SDK & Environment Variables
const androidHome =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  (process.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk')
    : path.join(process.env.HOME || '', 'Android', 'Sdk'));

if (androidHome && fs.existsSync(androidHome)) {
  pass('Android SDK directory', androidHome);

  // Check platforms
  const platformsDir = path.join(androidHome, 'platforms');
  if (fs.existsSync(platformsDir)) {
    const installed = fs.readdirSync(platformsDir).filter((d) => d.startsWith('android-'));
    if (installed.includes('android-35') || installed.includes('android-36')) {
      pass('Android SDK Platforms', installed.join(', '));
    } else {
      warn(
        `Installed SDK Platforms: ${installed.join(', ') || 'none'}`,
        'Install Android SDK Platform 35 or 36 via Android Studio SDK Manager.',
      );
    }
  }

  // Check build-tools
  const buildToolsDir = path.join(androidHome, 'build-tools');
  if (fs.existsSync(buildToolsDir)) {
    const tools = fs.readdirSync(buildToolsDir);
    if (tools.some((t) => t.startsWith('35.') || t.startsWith('36.'))) {
      pass('Android Build Tools', tools.join(', '));
    } else {
      warn(
        `Installed Build Tools: ${tools.join(', ') || 'none'}`,
        'Install Android SDK Build-Tools 36.0.0 via Android Studio.',
      );
    }
  }

  if (!process.env.ANDROID_HOME) {
    warn(
      'ANDROID_HOME environment variable is not explicitly set',
      `Add User/System environment variable ANDROID_HOME = "${androidHome}"`,
    );
  }
} else {
  fail(
    'Android SDK not found',
    'Install Android Studio and ensure Android SDK is installed at %LOCALAPPDATA%\\Android\\Sdk',
  );
}

// 5. adb (Android Debug Bridge)
const adbPath = runCmd('where adb') || runCmd('which adb');
if (adbPath) {
  const adbVer = runCmd('adb version');
  const shortVer = adbVer ? adbVer.split('\n')[0] : 'available';
  pass('Android Debug Bridge (adb)', shortVer);
} else {
  const candidateAdb = androidHome ? path.join(androidHome, 'platform-tools', 'adb.exe') : null;
  if (candidateAdb && fs.existsSync(candidateAdb)) {
    fail(
      'adb is installed but not in your PATH',
      `Add "${path.join(androidHome, 'platform-tools')}" to your system PATH environment variable.`,
    );
  } else {
    fail(
      'adb not found',
      'Install Android SDK Platform-Tools via Android Studio and add platform-tools to PATH.',
    );
  }
}

// 6. Connected Device Check
const adbDevicesOut = runCmd('adb devices');
if (adbDevicesOut) {
  const lines = adbDevicesOut
    .split('\n')
    .slice(1)
    .map((l) => l.trim())
    .filter(Boolean);

  const activeDevices = lines.filter((l) => l.endsWith('\tdevice') || l.endsWith(' device'));
  const unauthorized = lines.filter((l) => l.includes('unauthorized'));

  if (activeDevices.length > 0) {
    const names = activeDevices.map((d) => d.split(/\s+/)[0]).join(', ');
    pass('Connected Android Device(s)', names);
  } else if (unauthorized.length > 0) {
    warn(
      'Connected Android Device is UNAUTHORIZED',
      'Check your phone screen and tap "Always allow from this computer" for USB debugging.',
    );
  } else {
    console.log(
      '  \x1b[36mℹ\x1b[0m Connected Android Device \x1b[90m(None detected via USB. Connect phone with USB debugging enabled before running `yarn android`)\x1b[0m',
    );
  }
}

// 7. Native Module & Gradle Compatibility
const nativeGradlePath = path.join(
  ROOT_DIR,
  'modules',
  'surakshak-native',
  'android',
  'build.gradle',
);
if (fs.existsSync(nativeGradlePath)) {
  const gradleContent = fs.readFileSync(nativeGradlePath, 'utf-8');
  if (gradleContent.includes("apply plugin: 'expo-module-core'")) {
    fail(
      'modules/surakshak-native/android/build.gradle contains deprecated expo-module-core',
      "Change `apply plugin: 'expo-module-core'` to `apply plugin: 'expo-module-gradle-plugin'`.",
    );
  } else if (gradleContent.includes('expo-module-gradle-plugin')) {
    pass('Native Module Gradle Plugin', 'surakshak-native uses expo-module-gradle-plugin');
  } else {
    warn('Native Module build.gradle', 'Verify expo-module-gradle-plugin is applied.');
  }
} else {
  fail('Native module surakshak-native not found');
}

// 8. Environment Variables (.env.local / .env)
const envLocalPath = path.join(ROOT_DIR, '.env.local');
const envPath = path.join(ROOT_DIR, '.env');
const targetEnvFile = fs.existsSync(envLocalPath)
  ? envLocalPath
  : fs.existsSync(envPath)
    ? envPath
    : null;

if (!targetEnvFile) {
  fail(
    'No .env.local or .env file found',
    'Run `cp .env.example .env.local` and configure your environment variables.',
  );
} else {
  pass('Environment file', path.basename(targetEnvFile));

  const content = fs.readFileSync(targetEnvFile, 'utf-8');
  const parsedEnv = {};
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      parsedEnv[key] = val;
    }
  });

  const requiredKeys = [
    { key: 'EXPO_PUBLIC_APP_ENV', expected: 'dev' },
    { key: 'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID', isSecret: true },
    { key: 'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS', isSecret: true },
    { key: 'EXPO_PUBLIC_ONESIGNAL_APP_ID', isSecret: true },
    { key: 'EXPO_PUBLIC_MIXPANEL_TOKEN', isSecret: true },
    { key: 'EXPO_PUBLIC_SENTRY_DSN', isUrl: true },
  ];

  let envOk = true;
  for (const item of requiredKeys) {
    const val = parsedEnv[item.key];
    if (!val) {
      envOk = false;
      fail(`Missing ${item.key}`, `Set ${item.key} in ${path.basename(targetEnvFile)}`);
    } else if (item.isUrl) {
      if (!val.startsWith('http://') && !val.startsWith('https://')) {
        envOk = false;
        fail(
          `Invalid ${item.key}`,
          `${item.key} must be a valid URL starting with https:// (e.g., https://example@sentry.io/123)`,
        );
      }
    }
  }

  if (envOk) {
    pass('Required Environment Variables', 'All 6 variables populated and valid');
  }
}

// 9. Firebase Config Files
const devJsonPath = path.join(ROOT_DIR, 'google-services.dev.json');
const androidAppJsonPath = path.join(ROOT_DIR, 'android', 'app', 'google-services.json');
if (fs.existsSync(devJsonPath) || fs.existsSync(androidAppJsonPath)) {
  pass('Firebase Android Config', 'google-services.json detected');
} else {
  warn(
    'Firebase config google-services.dev.json missing',
    'Download google-services.json for com.surakshak.dev from Firebase Console and place as google-services.dev.json at repo root.',
  );
}

console.log('\n\x1b[1m--------------------------------------------------\x1b[0m');
if (failures === 0 && warnings === 0) {
  console.log(
    `\x1b[32m\x1b[1m🎉 All ${passedChecks} checks passed! You are ready to run \`yarn android\`!\x1b[0m\n`,
  );
} else if (failures === 0) {
  console.log(
    `\x1b[33m\x1b[1m⚠️ Environment is mostly ready (${passedChecks}/${totalChecks} checks passed, ${warnings} warning(s)). Review tips above before building.\x1b[0m\n`,
  );
} else {
  console.log(
    `\x1b[31m\x1b[1m❌ Setup incomplete: ${failures} failure(s), ${warnings} warning(s) (${passedChecks}/${totalChecks} passed). Resolve the issues above.\x1b[0m\n`,
  );
}
