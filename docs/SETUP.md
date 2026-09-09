# Setup — zero to a running app in 15 minutes

Follow this top to bottom. Every command is copy-paste ready.

---

## What you need first

Ask your lead for these before you start — you cannot finish without them:

1. The values for `.env.local` (Maps key, OneSignal app id, MixPanel token,
   Sentry DSN — all staging).
2. `google-services.staging.json` (Android Firebase config).
3. `GoogleService-Info.staging.plist` (iOS Firebase config).

All three are secret and none are in git.

---

## Step 1 — Install Node 20

### macOS

```bash
brew install node@20
node --version   # must print v20.x or newer
```

Or with nvm:

```bash
nvm install 20
nvm use 20
```

### Windows

Download the Node 20 LTS installer from <https://nodejs.org> and run it, then
in a **new** PowerShell window:

```powershell
node --version
```

---

## Step 2 — Turn on Yarn 4

This project uses Yarn 4, delivered by corepack (which ships inside Node):

```bash
corepack enable
```

### macOS / Linux

```bash
sudo corepack enable   # only if the command above says "permission denied"
```

### Windows

Run PowerShell **as Administrator** once:

```powershell
corepack enable
```

---

## Step 3 — Clone and install

```bash
git clone https://github.com/surakshak-redx-org/app.git
cd app
yarn --version    # must print 4.18.0
yarn install
```

`yarn install` takes 2–4 minutes the first time.

> ⚠️ **Never run `npm install` in this repo.** It creates a
> `package-lock.json` that conflicts with `yarn.lock`, and CI will fail.

---

## Step 4 — Secrets

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in every blank value from what your lead gave you.
Leave `EXPO_PUBLIC_APP_ENV=dev` — local development is always `dev`.

`.env.local` needs no Firebase keys. Firebase reads its native config files
instead. Put both in the repo root:

```
app/google-services.staging.json
app/GoogleService-Info.staging.plist
```

Both are gitignored, so you cannot commit them by accident.

---

## Step 5 — Run it

```bash
yarn start
```

Press `a` for Android or `i` for iOS, or scan the QR code with the Expo Go app.

You should land on the Welcome screen with a purple tab bar at the bottom.

---

## Step 6 — Confirm your setup is correct

```bash
yarn check
```

This runs typecheck, lint, prettier, the eslint-disable guard, and the full
test suite. All five must pass on a clean checkout. If they do, you are ready
to pick up your first issue.

---

## Troubleshooting

### Yarn prints the wrong version

`yarn --version` shows `1.22.x` instead of `4.18.0`.

An older Yarn earlier on your `PATH` is shadowing corepack's shim. Check where
each one lives:

```bash
which -a yarn      # macOS / Linux
where yarn         # Windows
```

If a Homebrew or global-npm Yarn comes first, either remove it
(`brew uninstall yarn`, or `npm uninstall -g yarn`) or reorder your `PATH` so
the Node bin directory comes first. You do not need Yarn 1 for anything here.

### "All versions satisfying X are quarantined"

Not a bug. Yarn is configured to refuse any package published in the last 24
hours — a supply-chain guard against typosquats and compromised releases. If
you hit this while adding a dependency, either wait a day or pick the previous
version. See `npmMinimalAgeGate` in `.yarnrc.yml`.

### Metro cache is stale after switching branches

```bash
yarn start --clear
```

### "Cannot find module 'google-services.staging.json'"

You skipped Step 4. The app runs without the file (the config guards for it),
but anything touching Firebase will fail until it is in place.

### Tests fail with "render function has not been called"

You forgot to `await`. React Native Testing Library v14 made `render`,
`renderHook`, `act` and `fireEvent` async:

```ts
const { getByText } = await render(<MyScreen />);
```

### Everything is broken and you want a clean slate

```bash
rm -rf node_modules .expo
yarn install
yarn start --clear
```
