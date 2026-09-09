import { z } from 'zod';

/**
 * The single gate for environment access — Surakshak absolute rule 15.
 * Nothing outside this file may read `process.env` directly.
 *
 * Firebase is deliberately absent: `@react-native-firebase` reads the native
 * `google-services.json` / `GoogleService-Info.plist` files and ignores env
 * vars entirely, so validating them here would only be theatre.
 */
const envSchema = z.object({
  APP_ENV: z.enum(['dev', 'staging', 'prod']),
  // Two keys, not one: a Google Maps key can only carry an Android app
  // restriction OR an iOS app restriction, never both — see app.config.ts.
  GOOGLE_MAPS_API_KEY_ANDROID: z.string().min(1),
  GOOGLE_MAPS_API_KEY_IOS: z.string().min(1),
  ONESIGNAL_APP_ID: z.string().min(1),
  MIXPANEL_TOKEN: z.string().min(1),
  SENTRY_DSN: z.url(),
});

/**
 * `process.env` is typed `any` by the Metro ambient declarations, so the bag is
 * declared `unknown` and zod does the narrowing. Reads must stay STATIC member
 * access — `babel-preset-expo` only inlines `EXPO_PUBLIC_*` when it can see the
 * property name, never through `process.env[key]`.
 */
const rawEnv: Record<string, unknown> = {
  APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  GOOGLE_MAPS_API_KEY_ANDROID: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID,
  GOOGLE_MAPS_API_KEY_IOS: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS,
  ONESIGNAL_APP_ID: process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID,
  MIXPANEL_TOKEN: process.env.EXPO_PUBLIC_MIXPANEL_TOKEN,
  SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
};

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  const missing = parsed.error.issues
    .map((issue) => `  • ${String(issue.path[0])}: ${issue.message}`)
    .join('\n');

  throw new Error(
    `\n❌ Surakshak startup failed — invalid environment variables:\n` +
      `${missing}\n\n` +
      `Copy .env.example to .env.local and fill in all values.\n`,
  );
}

export const ENV = parsed.data;

export type AppEnv = typeof ENV.APP_ENV;

/** MixPanel and Sentry must never initialise in dev — see CLAUDE.md. */
export const IS_TELEMETRY_ENABLED = ENV.APP_ENV !== 'dev';
