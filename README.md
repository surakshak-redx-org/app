# Surakshak

**Har Kadam, Surakshit** — Every Step, Protected.

A women's safety app for India. Expo SDK 57, TypeScript, Firebase.

|                      |                                                                |
| -------------------- | -------------------------------------------------------------- |
| Setup                | [docs/SETUP.md](docs/SETUP.md) — zero to running in 15 minutes |
| Contributing         | [CONTRIBUTING.md](CONTRIBUTING.md) — read before your first PR |
| Working with Claude  | [docs/SKILL.md](docs/SKILL.md)                                 |
| Architecture & rules | [CLAUDE.md](CLAUDE.md) — the single source of truth            |

## Quick start

```bash
corepack enable      # this project uses Yarn 4, never npm
yarn install
cp .env.example .env.local   # then fill it in
yarn start
```

## Checks

```bash
yarn check   # typecheck + lint + prettier + eslint-disable guard + tests
```

## Branches

```
production  ←  staging  ←  develop  ←  feature/xxx | fix/xxx | chore/xxx
```

All PRs target `develop`. Direct pushes to the three long-lived branches are
blocked for everyone.
