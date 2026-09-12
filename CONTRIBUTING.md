# Contributing to Surakshak

Welcome. This guide assumes you have never worked on a production React Native
codebase before. Read it once, all the way through, before your first PR.

Surakshak is a safety app. Someone in danger may press the SOS button and have
seconds to spare. That is why the rules below are strict and why CI refuses to
bend them — a crash here is not a bad user experience, it is a person who did
not get help.

---

## 1. Prerequisites

| Tool                | Version | Check with       |
| ------------------- | ------- | ---------------- |
| Node.js             | 22 LTS  | `node --version` |
| Corepack (Yarn)     | Yarn 4  | `yarn --version` |
| Git                 | any     | `git --version`  |
| Expo Go / Dev build | latest  | on your phone    |

**We use Yarn 4, not npm.** Yarn 4 comes from corepack, which ships inside Node:

```bash
corepack enable
```

Then, from inside the repo, `yarn --version` must print `4.18.0`. If it prints
`1.22.x`, an older Yarn earlier on your `PATH` is shadowing corepack — see
[docs/SETUP.md](docs/SETUP.md#yarn-prints-the-wrong-version).

Never run `npm install` in this repo. It writes a `package-lock.json` that
conflicts with `yarn.lock` and CI will reject the PR.

**VS Code extensions:** ESLint, Prettier, Tailwind CSS IntelliSense, Expo Tools.

---

## 2. Getting started

```bash
git clone https://github.com/surakshak-redx-org/app.git
cd app
corepack enable
yarn install

cp .env.example .env.local
# then fill in .env.local — ask your lead for the staging values

yarn start
```

You also need the Firebase config files, which are **never** committed. Ask your
lead for `google-services.json` and `GoogleService-Info.plist` and drop both in
the repo root. They are already gitignored.

Full walkthrough, including Windows: [docs/SETUP.md](docs/SETUP.md).

---

## 3. Branch naming

You only ever open PRs against `develop`. Never against `staging` or
`production`.

```
production  ←  staging  ←  develop  ←  your branch
```

| ✅ Correct                   | ❌ Wrong                |
| ---------------------------- | ----------------------- |
| `feature/sos-countdown`      | `sos-countdown`         |
| `feature/emergency-contacts` | `feature/SOS_Countdown` |
| `fix/otp-resend-timer`       | `bugfix/otp`            |
| `chore/upgrade-expo-57`      | `my-branch`             |

Only `feature/`, `fix/` and `chore/` prefixes are allowed, then lowercase words
separated by hyphens.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org),
lowercase subject, max 100 characters:

```
feat: add sos countdown timer
fix: correct otp resend interval
chore: bump expo to 57.0.20
```

Allowed types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `style`,
`ci`, `perf`.

---

## 4. The 15 rules, in plain English

These are enforced by CI. A PR that breaks any of them cannot merge.

**1. Never use `any`.** It switches TypeScript off for that value. If you truly
do not know the type, use `unknown` and narrow it with a check.

```ts
// ❌
function parse(data: any) {
  return data.name;
}

// ✅
function parse(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'name' in data) {
    return String(data.name);
  }
  throw new Error('Unexpected payload');
}
```

**2. Never write `@ts-ignore` or `@ts-expect-error`.** They hide a real type
error. Fix the type instead.

**3. Never write `eslint-disable`.** Same reasoning. A dedicated CI job greps
for it in `src/` and `app/`.

**4. Every user-facing string goes through `t()`.** We ship in English, Hindi
and Marathi. A hardcoded string can never be translated.

```tsx
// ❌
<Text variant="h1">Emergency Contacts</Text>

// ✅  add the key to src/i18n/locales/en.json first
<Text variant="h1" tKey="emergency.contacts" />
```

**5. No inline styles — NativeWind `className` only.**

```tsx
// ❌
<View style={{ padding: 16, backgroundColor: '#FFF' }} />

// ✅
<View className="bg-white p-4" />
```

**6. No magic numbers or strings.** Put them in `src/constants/`.

```ts
// ❌
if (secondsLeft === 5) { … }

// ✅
if (secondsLeft === APP_CONFIG.SOS_COUNTDOWN_SECONDS) { … }
```

**7. Every async function handles its errors** with `try/catch` or `.catch()`.
A rejected promise nobody catches crashes the app.

**8. Every function declares its return type**, including `void` and
`React.JSX.Element`.

**9. Every component's props have a typed interface.** No inline prop types.

**10. Every screen is wrapped in `<ErrorBoundary>`.** Copy the pattern from any
existing screen.

**11. Every service function has a unit test.**

**12. Every screen has at least a smoke test** proving it renders.

**13. Screens never call Firebase directly.** Always go through
`src/services/`. Screens are for UI; services are for data.

**14. Services never navigate.** No `router.push()` inside `src/services/`. A
service returns data or throws; the screen decides where to go next.

**15. Environment variables are read only in `src/config/env.ts`.** Everywhere
else, `import { ENV } from '@/config/env'`.

---

## 5. Husky: what happens when you commit

Three git hooks run automatically.

| Hook         | When         | What it does                                                  |
| ------------ | ------------ | ------------------------------------------------------------- |
| `pre-commit` | `git commit` | Lints + formats your staged files, greps for `eslint-disable` |
| `commit-msg` | `git commit` | Checks your commit message format                             |
| `pre-push`   | `git push`   | Runs the full TypeScript check                                |

**If a commit is blocked, that is the system working.** Read the error, fix the
code, `git add` the fix and commit again.

Common blocks and their fixes:

- _"eslint-disable comments are NOT allowed"_ — delete the comment and fix the
  underlying lint error.
- _"subject must be lower-case"_ — rewrite your commit message in lowercase.
- _"type must be one of feat, fix, chore…"_ — prefix your message with a valid
  type and a colon.
- A TypeScript error on push — run `yarn typecheck` locally to see it in full.

**Never use `--no-verify` to skip a hook.** CI runs the same checks and will
fail the PR anyway.

---

## 6. Running the checks yourself

Run this before every push. It is the same set CI runs:

```bash
yarn check
```

Or individually:

```bash
yarn typecheck      # tsc --noEmit
yarn lint           # eslint, zero warnings allowed
yarn format:check   # prettier
yarn test --ci      # jest
yarn no-eslint-disable
```

To fix things automatically where possible:

```bash
yarn lint:fix
yarn format
```

---

## 7. Opening a PR

1. Branch off the latest `develop`:
   ```bash
   git checkout develop && git pull
   git checkout -b feature/your-thing
   ```
2. Make your change. Commit in small, logical steps.
3. Run `yarn check` until it is clean.
4. Push: `git push -u origin feature/your-thing`
5. Open the PR on GitHub **targeting `develop`**.
6. Fill in the whole PR template. Tick the boxes honestly — an unticked box is
   fine, a falsely ticked one wastes a reviewer's time.
7. Wait for CI (`pr-checks.yml`) to go green.
8. Run `/code-review` (see §8) and address anything it flags before asking a
   human to look.
9. Request a human review.

To merge you need: all pipeline checks green and one human approval. There is
no automated bot review in CI — see §8.

---

## 8. Code review with Claude Code

There is no automated review workflow in CI — that was removed to stop
per-PR API-token spend, now that reviews go through a Claude Code
subscription instead. Run it yourself, on demand, before asking a human:

```
/code-review              # review your current branch's diff
/code-review <PR number>  # review an already-open PR
```

Address what it flags, push again, and re-run if the diff changed
meaningfully. `/code-review ultra` (or the `/ultrareview` alias) runs a
heavier multi-agent cloud review — reach for it on a larger or riskier PR.

Judgement still applies: not every suggestion is a blocker, and you may
disagree with one — say so in a PR comment. A human makes the final call.

---

## 9. The five most common mistakes

**1. Hardcoded strings.**
Add the key to `src/i18n/locales/en.json`, then use `tKey`. Also add a real
Hindi and Marathi translation to `hi.json` and `mr.json` — `yarn
validate:translations` enforces that all three files have identical key sets
**and** that none of the three has a missing or empty value for any key.

**2. Relative imports.**

```ts
import { Button } from '../../../components/ui/Button'; // ❌
import { Button } from '@/components/ui/Button'; // ✅
```

**3. Missing return types.**

```ts
export function getName() { … }                    // ❌
export function getName(): string { … }            // ✅
export default function Screen(): React.JSX.Element { … }  // ✅
```

**4. Calling Firebase from a screen.**
Move the call into `src/services/`, then call the service from the screen.

**5. Forgetting the test.**
New service function → a test in `tests/services/`. New screen → a smoke test
in `tests/screens/`. Copy an existing one; they are all the same shape.

**Bonus trap: `app.json` reappearing.**
`yarn expo install <native-package>` writes an `app.json` to record the config
plugin it auto-detected. This project has no `app.json` — `app.config.ts` is the
only config file. Delete the generated `app.json` and add the plugin to the
`plugins` array in `app.config.ts` by hand. `yarn dlx expo-doctor@latest` will
tell you if you forget.

> Note on tests: this project uses React Native Testing Library **v14**, where
> `render`, `renderHook`, `act` and `fireEvent` are all **async**. Always
> `await` them, or your assertions will run against nothing.

---

## 10. E2E tests (Maestro)

Flows live in `.maestro/flows/`, listed in `.maestro/config.yaml`. They run
against a local dev build (`com.surakshak.dev`), not Expo Go.

```bash
brew tap mobile-dev-inc/tap
brew install maestro
eas build --profile develop --local   # or a build you already have installed
maestro test .maestro/                # runs every flow in config.yaml
maestro test .maestro/flows/home_sos_cancel.yaml   # a single flow
```

Keep a flow's `assertVisible`/`tapOn` strings matching the real English copy
in `src/i18n/locales/en.json` — Maestro matches visible text, so a renamed
string breaks the flow, not just the app.

## 11. Coverage

```bash
yarn test --ci --coverage
```

`jest.config.js` enforces a 70% floor on all four metrics (statements,
branches, functions, lines). A PR that drops any of them below 70% fails
`pr-checks.yml`. New code should carry its own tests rather than rely on
the floor being loose elsewhere.

## Pre-PR checklist

- [ ] `yarn check` is clean (typecheck, lint, prettier, no-eslint-disable,
      tests)
- [ ] `yarn validate:translations` passes (new strings exist in all three
      locales, none blank)
- [ ] `yarn test --ci --coverage` stays at or above 70% on all four metrics
- [ ] A Maestro flow updated if you changed visible copy or navigation it
      depends on
- [ ] `/code-review` run and addressed (see §8)
- [ ] PR targets `develop`, template filled in honestly

## 12. Getting help

- Stuck on a rule or a failing check? Open an issue with the _Bug Report_
  template.
- Unsure about an approach before you build it? Open an issue with the
  _Feature Request_ template and describe the problem.
- Question on an open PR? Comment on it and tag `@surakshak-redx-org`.

Ask early. A five-minute question beats a day spent in the wrong direction.
