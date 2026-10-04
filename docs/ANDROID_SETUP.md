# 🤖 Surakshak Android Setup & Development Guide (Windows)

A step-by-step setup guide for new developers on **Windows** to set up, build, and run the Surakshak development app on a physical Android device or emulator with minimal debugging.

---

## ⚡ The Quick Summary: Why Expo Go Does NOT Work

> ⚠️ **IMPORTANT**: You **cannot** use the regular Expo Go app from Google Play Store for Surakshak.
>
> A common question from new team members is:
> _"Can't I just install Node.js on my laptop and scan the QR code with the Expo Go app on my phone?"_
>
> **The answer is NO**, because Surakshak uses custom native Android capabilities:
>
> 1. **React Native Firebase** (`@react-native-firebase/*`): Requires compiled native Android C++/Java libraries and the Google Services Gradle plugin.
> 2. **Surakshak Custom Native Module** (`modules/surakshak-native`): Contains Kotlin code interacting directly with Android's `SmsManager` and `CALL_PHONE` system APIs to send zero-tap emergency SMS and place direct calls during life-threatening situations. Expo Go does not contain this custom code.
> 3. **OneSignal Push Notifications**: Requires native Android manifest and notification service registration.
>
> If you try to open Surakshak inside standard Expo Go, the app will **crash immediately** because the required native modules do not exist in the Expo Go APK.
>
> **The Solution: Expo Development Client (`expo-dev-client`)**
>
> - You build a custom development APK **once** on your computer and install it on your Android phone using `yarn android`.
> - Once installed, your daily workflow is identical to Expo Go: you run `yarn start:dev`, edit code in VS Code, and see Fast Refresh update instantly on your phone over USB or Wi-Fi without compiling native code every time!

---

## 📋 Prerequisites & Required Versions

| Tool                     | Required Version                                  | Why & Notes                                                    |
| :----------------------- | :------------------------------------------------ | :------------------------------------------------------------- |
| **Operating System**     | Windows 10 / 11 (64-bit)                          | PowerShell / CMD                                               |
| **Node.js**              | **v22.x LTS** (e.g. 22.14.0)                      | Repo target in `.nvmrc` (>= 20.x supported)                    |
| **Package Manager**      | **Yarn 4.18.0**                                   | Enabled via `corepack enable`. **Never use `npm install`**.    |
| **Java Development Kit** | **JDK 21**                                        | Eclipse Adoptium Temurin 21. Gradle 9.3.1 requires Java 17–21. |
| **Android Studio**       | Ladybug (2024.2.1+) or newer                      | Provides Android SDK, platform tools, and build tools          |
| **Android SDK Platform** | **Android 15 (API 35)** & **Android 16 (API 36)** | `compileSdk 36`, `targetSdk 36`, `minSdk 24`                   |
| **Android Build-Tools**  | **36.0.0**                                        | Used by Expo SDK 57 root project                               |
| **Android NDK**          | **27.1.12297006**                                 | Required for C++ native dependencies                           |
| **CMake**                | **3.30.5** (or 3.22.1+)                           | Required by React Native 0.86+ C++ toolchain                   |
| **Android Device**       | Physical Android phone (Android 7.0+ / API 24+)   | With USB Cable & USB Debugging enabled                         |

---

## 🛠️ Step 1 — Install Node.js & Yarn 4

1. Download and run the **Node.js 22 LTS (x64)** installer from [https://nodejs.org](https://nodejs.org).
2. Open PowerShell **as Administrator** and enable Yarn 4 via Corepack:
   ```powershell
   corepack enable
   ```
3. Open a normal PowerShell window and verify:
   ```powershell
   node --version   # Should output v22.x.x
   yarn --version   # Should output 4.18.0
   ```
   > 💡 If `yarn --version` prints `1.22.x`, an old global Yarn is shadowing Corepack. Run `where yarn` and uninstall the older Yarn (`npm uninstall -g yarn` or remove old Yarn folder).

---

## ☕ Step 2 — Install Java JDK 21

1. Download **Eclipse Adoptium Temurin JDK 21 (x64 Windows installer)** from [https://adoptium.net/temurin/releases/?version=21](https://adoptium.net/temurin/releases/?version=21).
2. During installation, ensure **"Set JAVA_HOME variable"** and **"Add to PATH"** are checked.
3. Verify in a new PowerShell window:
   ```powershell
   java -version
   ```
   _Should show `openjdk version "21.x.x"`._

---

## 📱 Step 3 — Install Android Studio & Android SDK

1. Download and install **Android Studio** from [https://developer.android.com/studio](https://developer.android.com/studio).
2. Open Android Studio → **More Actions** (or **Settings**) → **SDK Manager**:
   - **SDK Platforms tab**:
     - Check **Android 15.0 ("VanillaIceCream") - API 35**
     - Check **Android 16 - API 36**
   - **SDK Tools tab** (check "Show Package Details" at bottom right):
     - Check **Android SDK Build-Tools 36.0.0** (and 35.0.0)
     - Check **NDK (Side by side)** → select **27.1.12297006**
     - Check **Android SDK Command-line Tools (latest)**
     - Check **Android SDK Platform-Tools**
     - Check **CMake** → select **3.30.5** (check "Show Package Details" to select version 3.30.5; keep 3.22.1 as fallback)
3. Click **Apply** to download and install.

---

## 🌐 Step 4 — Configure Windows Environment Variables

1. Press `Win + S`, type **Environment Variables**, and select **Edit the system environment variables**.
2. Click **Environment Variables...** button.
3. Under **User variables** (or System variables):
   - Click **New...**:
     - Variable name: `ANDROID_HOME`
     - Variable value: `C:\Users\<YOUR_USERNAME>\AppData\Local\Android\Sdk`
       _(Replace `<YOUR_USERNAME>` with your actual Windows username)_
   - Click **New...**:
     - Variable name: `JAVA_HOME`
     - Variable value: `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot` _(or your installed JDK 21 path)_
4. Under **User variables** (or System variables), find **`Path`** (or `PATH`), select it and click **Edit...**:
   - Click **New** and add: `%ANDROID_HOME%\platform-tools`
   - Click **New** and add: `%ANDROID_HOME%\emulator`
   - Click **New** and add: `%ANDROID_HOME%\cmdline-tools\latest\bin`
   - Click **New** and add: `%JAVA_HOME%\bin`
5. Click **OK** on all dialogs to save.
6. Open a **brand new** PowerShell window and test:
   ```powershell
   adb --version
   ```
   _Should output `Android Debug Bridge version 1.0.41`._

---

## 🔌 Step 5 — Prepare Your Physical Android Phone

1. **Enable Developer Options**:
   - Open **Settings** on your Android phone.
   - Go to **About Phone** (or **System → About Phone**).
   - Tap **Build Number** 7 times continuously until you see the prompt: _"You are now a developer!"_
2. **Enable USB Debugging**:
   - Go to **Settings → System → Developer Options**.
   - Turn ON **USB Debugging**.
   - _(Optional on Xiaomi/MIUI/HyperOS)_: Also turn ON **USB Debugging (Security settings)** and **Install via USB**.
3. **Connect Phone to PC**:
   - Plug phone into PC using a good quality USB data cable.
   - Set USB connection mode to **File Transfer / MTP** (not charging only).
   - Look at your phone screen: a dialog will appear saying **"Allow USB debugging?"**.
   - Check **"Always allow from this computer"** and tap **Allow**.
4. **Verify Connection**:
   In PowerShell, run:
   ```powershell
   adb devices
   ```
   Output **must** show your device with status `device`:
   ```text
   List of devices attached
   RZ8M123456X    device
   ```
   > ⚠️ If it shows `unauthorized`, unlock your phone and accept the prompt. If it shows nothing, check your USB cable/drivers.

---

## 📦 Step 6 — Clone Repository & Install Dependencies

```powershell
git clone https://github.com/surakshak-redx-org/app.git
cd app
yarn install
```

_(First install takes 2–4 minutes to link dependencies)._

---

## 🔑 Step 7 — Configure `.env.local` and Firebase

### 1. Environment Variables:

Copy the example file:

```powershell
cp .env.example .env.local
```

Open `.env.local` in your editor. For local development, configure:

```env
EXPO_PUBLIC_APP_ENV=dev
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID=<ask team lead or staging key>
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS=<ask team lead or staging key>
EXPO_PUBLIC_ONESIGNAL_APP_ID=<ask team lead or staging OneSignal App UUID>
EXPO_PUBLIC_MIXPANEL_TOKEN=<ask team lead or staging token>
EXPO_PUBLIC_SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
```

> ⚠️ **CRITICAL NOTE ON SENTRY_DSN**:
> The startup validator in `src/config/env.ts` uses `z.url()`. The value **MUST** be a valid URL starting with `https://`. Even if you are waiting for a team key, use a valid URL placeholder like `https://examplePublicKey@o0.ingest.sentry.io/0`. An empty string or arbitrary string will crash startup!

### 2. Firebase Config File (`google-services.dev.json`):

Ask your team lead for `google-services.dev.json` (for package `com.surakshak.dev`) and place it directly in the project root:

```text
app/google-services.dev.json
```

_(Alternatively, you can place it as `android/app/google-services.json`). This file is gitignored._

---

## 🩺 Step 8 — Run the Setup Health Check

Run the automated setup validation script:

```powershell
yarn setup:check
```

You should see:

```text
🔍 Checking Surakshak Development Environment...

  ✓ Node.js (v22.x.x - compatible >= 20.x, recommended 22.x LTS)
  ✓ Package Manager (Yarn) (v4.18.0)
  ✓ Java JDK (JDK 21 detected (Supported: JDK 21 for Gradle 9.3.1))
  ✓ Android SDK directory (C:\Users\...\AppData\Local\Android\Sdk)
  ✓ Android SDK Platforms (android-35, android-36)
  ✓ Android Build Tools (36.0.0)
  ✓ Android Debug Bridge (adb) (Android Debug Bridge version 1.0.41)
  ✓ Connected Android Device(s) (RZ8M123456X)
  ✓ Native Module Gradle Plugin (surakshak-native uses expo-module-gradle-plugin)
  ✓ Environment file (.env.local)
  ✓ Required Environment Variables (All 6 variables populated and valid)
  ✓ Firebase Android Config (google-services.json detected)

--------------------------------------------------
🎉 All checks passed! You are ready to run `yarn android`!
```

If any check fails (marked with `✗`), follow the exact fix suggestion printed in the terminal.

---

## 🚀 Step 9 — Build & Install the Development App (One-Time)

With your Android phone unlocked and connected via USB (`adb devices` showing `device`), run:

```powershell
yarn android
```

### What this does:

1. Compiles the native Android project via Gradle.
2. Compiles our custom native Kotlin module (`surakshak-native`).
3. Links React Native Firebase, OneSignal, Maps, and Camera native binaries.
4. Generates the development APK (`com.surakshak.dev`).
5. Installs the APK onto your connected phone via `adb`.
6. Launches the **Surakshak-dev** app and connects it to the Metro bundler.

> ⏱️ **Note**: The very first build takes **5 to 10 minutes** because Gradle downloads dependencies and compiles native code. Subsequent builds are cached and much faster.

---

## 🔄 Daily Development Workflow (Fast Refresh)

You **do NOT** need to run `yarn android` every time you write code!

Once the **Surakshak-dev** app is installed on your phone:

1. Connect your phone via USB (or ensure phone and PC are on the same Wi-Fi network).
   - If connected via USB, reverse the Metro port so the device routes directly to your PC:
     ```powershell
     adb reverse tcp:8081 tcp:8081
     ```
2. Start the Metro development server:
   ```powershell
   yarn start:dev
   ```
3. Tap the **Surakshak-dev** app on your phone. It will automatically connect to your Metro bundler.
4. Edit any `.ts` or `.tsx` file in your editor — the changes will reflect **instantly** via Fast Refresh!
5. **Useful keyboard shortcuts in terminal**:
   - `r` — Reload the app JavaScript bundle.
   - `m` — Toggle developer menu on phone (or shake your phone).
   - `c` — Clear terminal console.

> ℹ️ **When do you need to run `yarn android` again?**
> ONLY when:
>
> - You add or upgrade a library with native code in `package.json`
> - You modify files in `modules/surakshak-native/android/`
> - You modify files in `android/`
> - You update `app.config.ts` native permissions or plugins

---

## 🔧 Troubleshooting Common Errors

### 1. `Plugin with id 'expo-module-core' not found`

- **Cause**: Expo SDK 57 deprecated `expo-module-core` Gradle plugin.
- **Fix**: Open `modules/surakshak-native/android/build.gradle` and ensure line 2 is:
  ```groovy
  apply plugin: 'expo-module-gradle-plugin'
  ```

### 2. `SoftwareComponent with name 'release' not found`

- **Cause**: Triggered when a subproject build.gradle contains legacy manual publish or invalid plugin references.
- **Fix**: Ensure `modules/surakshak-native/android/build.gradle` uses `apply plugin: 'expo-module-gradle-plugin'` and does not have manual publication blocks.

### 3. `org.gradle.java.home` points to a directory that does not exist

- **Error**: `Directory 'C:\Program Files\Eclipse Adoptium\jdk-21...' does not exist.`
- **Cause**: `android/gradle.properties` has a hardcoded path matching another contributor's machine.
- **Fix**: Open `android/gradle.properties` and update `org.gradle.java.home` to your actual JDK 21 installation path, or comment it out (`# org.gradle.java.home=...`) so Gradle uses your system `JAVA_HOME`.

### 4. `ANDROID_HOME` missing or not recognized

- **Error**: `SDK location not found. Define a location with an ANDROID_HOME environment variable or by setting the sdk.dir path in your project's local properties file.`
- **Fix**:
  1. Create a file `android/local.properties` (gitignored):
     ```properties
     sdk.dir=C:\\Users\\<YOUR_USERNAME>\\AppData\\Local\\Android\\Sdk
     ```
  2. Set `ANDROID_HOME` in Windows Environment Variables and restart your terminal.

### 5. `adb devices` shows `unauthorized` or is empty

- **If `unauthorized`**:
  - Unplug USB cable.
  - On phone: Settings → Developer Options → **Revoke USB debugging authorizations**.
  - Reconnect USB cable.
  - Unlock phone screen and tap **"Always allow from this computer"**.
- **If empty**:
  - Ensure USB mode is "File Transfer (MTP)", not "Charging only".
  - Try another USB port or cable.
  - Install OEM USB Drivers for your phone brand (Samsung, Google, Xiaomi, etc.).

### 6. `❌ Surakshak startup failed — invalid environment variables`

- **Error**: `SENTRY_DSN: Invalid url` or missing variables.
- **Fix**:
  - Ensure `.env.local` exists.
  - Ensure `EXPO_PUBLIC_APP_ENV=dev`.
  - Ensure `EXPO_PUBLIC_SENTRY_DSN` is a valid URL starting with `https://` (e.g. `https://examplePublicKey@o0.ingest.sentry.io/0`).

### 7. Gradle Daemon or Cache Issues

- If Gradle hangs or throws unexpected cache errors:
  ```powershell
  cd android
  .\gradlew.bat --stop
  .\gradlew.bat clean
  cd ..
  yarn start --clear
  ```

### 8. Stuck on Red Screen / Bundling Errors

- Clear Metro bundler cache:
  ```powershell
  yarn start:dev --clear
  ```
