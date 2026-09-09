import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are a senior engineer reviewing PRs for
Surakshak — a women's safety app for India.
College student juniors are contributing. Be thorough and direct.

Non-negotiable standards:
1. No 'any' type
2. No eslint-disable, ts-ignore, ts-expect-error
3. All functions must have explicit return types
4. All component props must have typed interfaces
5. No inline styles — NativeWind className only
6. No hardcoded strings — must use t() from i18n
7. No Firebase calls in components — use src/services/
8. All async code must have error handling
9. No magic numbers/strings — use src/constants/
10. New service functions must have unit tests
11. New screens must have smoke tests
12. Imports must use @/ alias — no relative paths
13. No navigation logic in service files

Format exactly as:

## 🛡️ Surakshak Code Review

**PR:** {{title}} by @{{author}}

### ✅ What's Good
- [specific positives]

### 🚨 Must Fix Before Merge
> Leave empty if no blocking issues.
1. \`file.tsx:line\` — [issue and fix]

### 💡 Suggestions (Non-blocking)
1. [improvement]

### 📊 Verdict: APPROVE | REQUEST CHANGES
[one paragraph]

---
*Fix all Must Fix items before requesting human review.*`;

const FALLBACK_NOTICE = [
  '## 🛡️ Surakshak Code Review',
  '',
  '⚠️ The automated review could not run for this commit. A human reviewer should',
  'read this PR in full before approving.',
  '',
  '_This does not block the pipeline — the other PR checks still apply._',
].join('\n');

async function main() {
  const diff = process.env.PR_DIFF ?? '';

  if (diff.trim().length === 0) {
    process.stdout.write('## 🛡️ Surakshak Code Review\n\nNo TypeScript changes to review.\n');
    return;
  }

  const client = new Anthropic();

  const response = await client.messages.create({
    model: 'claude-opus-5',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          `PR Title: ${process.env.PR_TITLE ?? '(none)'}`,
          `PR Author: ${process.env.PR_AUTHOR ?? '(unknown)'}`,
          `PR Description: ${process.env.PR_BODY ?? '(none)'}`,
          '',
          'Diff:',
          diff,
        ].join('\n'),
      },
    ],
  });

  // A refusal is a normal 200 response, not an exception — check it before
  // reading content.
  if (response.stop_reason === 'refusal') {
    process.stdout.write(FALLBACK_NOTICE);
    return;
  }

  // With thinking enabled, content[0] is a thinking block, not the text —
  // always find the text block by type rather than by index.
  const text = response.content.find((block) => block.type === 'text')?.text ?? '';

  process.stdout.write(text.length > 0 ? text : FALLBACK_NOTICE);
}

try {
  await main();
} catch (error) {
  // Never fail the PR because the review bot had a bad day — surface a notice
  // and let the other checks gate the merge.
  if (error instanceof Anthropic.APIError) {
    process.stderr.write(`Anthropic API error ${error.status}: ${error.message}\n`);
  } else {
    process.stderr.write(`Claude review failed: ${String(error)}\n`);
  }
  process.stdout.write(FALLBACK_NOTICE);
}
