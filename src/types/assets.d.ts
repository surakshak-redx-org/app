/**
 * Metro turns a bundled audio asset import into an opaque module reference
 * (a number at runtime). Expo's own asset typings cover images but not audio.
 */
declare module '*.mp3' {
  const source: number;
  export default source;
}

declare module '*.wav' {
  const source: number;
  export default source;
}
