# Android Home Screen Widget — TODO

## Status

Home screen widgets require native code and are not yet stable in Expo
managed workflow (SDK 57). No community package (`expo-widgets`,
`@bam.tech/react-native-widget-extension`) was found to be a safe bet against
this SDK's Kotlin/Gradle toolchain, so no widget implementation ships in
Phase 7.

## Planned Implementation

- Library: `expo-widgets` (once stable) or a bare-workflow migration for the
  widget module specifically.
- Widget: 2x1 tile with the Surakshak logo and a large "SOS" button.
- Tap behavior: opens the app directly to the SOS countdown screen.
- Background: `PRIMARY_RED` (`#D4380D`).

## Current Workaround

Users can add Surakshak to their home screen directly (Android):

1. Long press on the app icon.
2. Drag it to the home screen.

## Requirements When Implemented

- Android only (iOS widgets require Apple Developer enrollment and a
  separate WidgetKit extension target).
- Must work even when the app is not running.
- Tap must open the app to `/(tabs)/` with SOS auto-triggered.
