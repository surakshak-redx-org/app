#!/bin/bash
# Surakshak absolute rule 3: no eslint-disable comments anywhere in src/ or app/.
# Suppressing a lint error hides a real problem; fix the code instead.

FOUND=$(grep -rn "eslint-disable" --include="*.ts" --include="*.tsx" src/ app/ 2>/dev/null)

if [ -n "$FOUND" ]; then
  echo ""
  echo "❌ ERROR: eslint-disable comments are NOT allowed in Surakshak."
  echo "   Fix the actual lint issue instead of suppressing it."
  echo ""
  echo "$FOUND"
  echo ""
  exit 1
fi

echo "✅ No eslint-disable comments found"
exit 0
