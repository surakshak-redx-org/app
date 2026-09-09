## 📋 What does this PR do?

Closes #

---

## 🔄 Type of Change

- [ ] 🆕 New feature
- [ ] 🐛 Bug fix
- [ ] ♻️ Refactor
- [ ] 🎨 UI / Style update
- [ ] 🧪 Tests only
- [ ] 🔧 Config / CI
- [ ] 📝 Docs only

---

## ✅ Pre-Merge Checklist

### Code Quality

- [ ] `yarn typecheck` — 0 errors
- [ ] `yarn lint` — 0 warnings
- [ ] `yarn format:check` — 0 errors
- [ ] `yarn no-eslint-disable` — clean
- [ ] No `any` types added

> Tip: `yarn check` runs all five in order.

### Surakshak Standards

- [ ] All user-facing strings use `t()` — no hardcoded strings
- [ ] No Firebase calls in components — all via `src/services/`
- [ ] No inline styles — NativeWind `className` only
- [ ] All new functions have explicit return types
- [ ] All new props have typed interfaces
- [ ] All async operations have error handling
- [ ] No magic numbers/strings — used `src/constants/`
- [ ] All imports use `@/` alias

### Tests

- [ ] Unit tests for new service / utility functions
- [ ] Smoke test for any new screen
- [ ] `yarn test --ci` passes locally

### Branch

- [ ] Named `feature/xxx`, `fix/xxx`, or `chore/xxx`
- [ ] Up to date with `develop` (rebased, no merge commits)

---

## 🧪 How to Test

1.
2.
3.

---

## 📸 Screenshots / Recording

| Before | After |
| ------ | ----- |
| —      | —     |

---

## 🤖 Claude Bot Review

<!-- Claude reviews automatically. Fix all Must Fix items before tagging
     for human review. Do not request review if Claude posted REQUEST CHANGES. -->

---

## 💬 Notes for Reviewer
