# assets/sounds

Bundled audio for the emergency features. Both files are **synthesised
placeholders** (pure tones, generated with a short Python script) so the bundle
and tests have something real to load. Swap them for polished, royalty-free
audio (freesound.org, CC0) before a production release — keep the same
filenames so no code changes are needed.

| File           | Used by                           | What it should be                              |
| -------------- | --------------------------------- | ---------------------------------------------- |
| `siren.wav`    | `src/hooks/useSiren.ts`           | Loud, seamlessly loopable alarm / siren tone   |
| `ringtone.wav` | `IncomingCallOverlay` (fake call) | A ringtone with a natural ring / pause cadence |
