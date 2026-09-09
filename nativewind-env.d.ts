/// <reference types="nativewind/types" />

// The global stylesheet is consumed by the NativeWind Metro transformer, not by
// TypeScript — this just stops `import '@/global.css'` from erroring.
declare module '*.css';
