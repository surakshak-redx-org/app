# Silent Video Evidence — TODO

## Status

Phase 7 ships Silent Evidence Recording as **audio-only**. `expo-av` (the
library the original brief called for) is dead at SDK 57 — see CLAUDE.md's
Phase 1 Corrections — and its replacement for recording is split into two
packages: `expo-audio` (already used here) and `expo-video`, which is a
_playback_ library with no recording API of its own. Recording video needs
`expo-camera`'s `CameraView.recordAsync()` / `stopRecording()` instead, which
in turn needs a full-screen camera viewfinder component — a distinct, larger
piece of work than adding a second output format to the existing recorder
screen, so it's deferred rather than built partially.

## Planned Implementation

- Library: `expo-camera` (already a dependency, currently only used for a
  permission check in `src/utils/permissions.utils.ts`).
- A new full-screen `CameraView` route (or a mode on `app/silent-recording.tsx`)
  with a discreet/minimal viewfinder, `recordAsync()` on start,
  `stopRecording()` on stop.
- Same upload path as audio: `evidence/{userId}/{timestamp}.mp4` via
  `@react-native-firebase/storage`, reusing the `incident.service.ts` upload
  pattern (progress callback, `getDownloadURL`).
- Re-add the audio/video type selector to `app/silent-recording.tsx` once
  both recording pipelines exist.

## Requirements When Implemented

- Must request both camera and microphone permissions before recording.
- Must respect `APP_CONFIG.MAX_EVIDENCE_RECORDING_MINUTES` the same way the
  audio recorder does (auto-stop-and-upload).
- Should keep the recording screen usable one-handed and discreet — a large
  viewfinder preview may not be desirable for a safety feature meant to be
  used without drawing attention.
