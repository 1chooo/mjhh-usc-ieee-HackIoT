---
name: 1chooo-commits
description: >-
  Write git history as small conventional commits, each a step a later
  reader can replay. Use when the user asks to commit, split a diff, write
  a commit message, review commit style, or plan a commit chain, including
  ticket scope and monorepo app scope.
license: MIT
metadata:
  author: 1chooo
  version: "1.5.0"
---

# 1chooo Commits

A commit is one step. `git log` should let a later reader replay the path. This skill is the reference for that step: the subject, the scope, when a body earns its place, and how to split a mixed diff into a chain. Consult it before you stage.

Read `git log` before you invent a scope. Commit only after the user asks. Stay on the current branch, including `main`, in the repo that owns the files. Stay local until the user asks to push.

## What a good commit is

The subject stands alone in `git log --oneline`. It names one step, in the imperative. The body, when the subject cannot carry it, says why.

```
type(scope): imperative summary

optional body

optional footer
```

Scope may be omitted: `type: imperative summary`.

Types: `feat` `fix` `refactor` `perf` `docs` `test` `chore` `style` `build` `ci` `revert`

- **Subject.** Imperative, lowercase after the colon, no trailing period. Aim for 50 characters. Hard cap 72. `add`, not `added` or `adds`.
- **Body.** Skip it when the subject is enough. Write why, not a file list. Always write one for a breaking change, a security fix, a data migration, or a revert.
- **Breaking.** `type(scope)!:` plus a `BREAKING CHANGE:` footer that says what callers must do.

Validate before you commit: the type is on the list, the verb is imperative, and any body or footer adds something the subject cannot.

Leave these out of the message: "This commit does X", "I", "we", "now", "currently"; AI attribution (`Generated with …`, Co-authored-by an AI); emoji, unless this repo already uses it; a filename the scope already names; customer names, emails, support-ticket contents, secrets, or other personal data. Describe the technical symptom.

## Scope

**Ticket is the scope** when this repo already writes `feat(JH-142):`. Do not invent ticket IDs. One ID per commit. The ticket wins over the app name. If both matter, name the app in the summary (`feat(JH-142): add web member checkout`) or in the body. The ticket is already in scope, so do not also write `Closes JH-142`.

**Ticket stays off the subject** when the repo keeps it on the branch and the pull request title. Write `type:` or `type(area):`.

```
fix: soften the press ripple
```

**No ticket.** Scope the app or package.

```
feat(web): ...
feat(mobile): ...
fix(api): ...
```

Scope the thing you changed. Do not restate the type (`docs(docs):`, `test(test):`, `chore(chore):`).

| Situation | Subject |
|-----------|---------|
| Feature in the web app | `feat(web):` |
| Docs about the web app | `docs(web):` |
| Repo-wide docs, or a `docs` package with no better target | `docs:` |
| Tests for mobile | `test(mobile):` |

| Repo | Typical scopes |
|------|----------------|
| JustHold | `web`, `api`, `tokens`, `agents`, `mobile` |
| 1chooo.com | `bio`, `projects`, `services`, `admin`, `articles` |

## Footers

`Closes #42` or `Fixes #42` closes an extra issue. `Refs #17` links without closing. A breaking change gets `BREAKING CHANGE: <what callers must do>`.

## Anti-patterns

- **No step in the subject**: `chore: cleanup`. Name the change.
- **Type as scope**: `docs(docs): update readme`. Scope the thing you documented.
- **Ticket in the wrong place**: `feat(web): JH-142 add checkout`, or `PROJ-12: soften the press ripple`. Match where this repo already puts the key.
- **Noun phrase**: `feat(JH-142): checkout flow`. Use an imperative verb.
- **Several steps, one subject**: `refactor(web): remove headers and fix layout and update docs`. Split the chain.

## Plan the chain

In plan mode, name the chain before any code. The goal is the outcome. The chain is the replay. Commit each step as it finishes. Split a diff that already exists only when the user asks.

```
feat: parse stored markup into blocks
feat: render formatted bodies on the detail screen
feat: preview bodies as plain text in the list
fix: keep hyphenated words on one line
test: cover each markup mark
fix: handle links the device cannot open
```

Several repos means one chain per repo.

When the tree mixes concerns and no plan already named the chain, group one reviewable step (one UI surface, one API layer, or one docs pass), stage only that group, and repeat until the tree is clean. Prefer a short chain over one commit that mixes steps.

## When you commit

1. Run `git status` and `git diff --staged`. If nothing is staged, use `git diff`.
2. If a plan already named the chain, take the next step. Otherwise pick one step and stage only that group.
3. Write the message so the subject stands alone in `git log --oneline`.
4. Commit with a HEREDOC. A literal `\n` inside `-m` is a broken message:

```bash
git commit -m "$(cat <<'EOF'
type(scope): imperative summary

Optional body: why this step matters.

Optional footer
EOF
)"
```

5. If a hook fails or rewrites files, fix the problem and make a new commit. Amend only when the user asked, HEAD is this session's commit, and it has not been pushed.

- Never stage secrets (`.env`, credentials, private keys).
- Never skip hooks (`--no-verify`) unless the user asks.
- Never update git config, force-push `main` or `master`, or run destructive git unless the user asks.
- Do not squash the chain before a pull request unless the user asks.

## Examples

Member desktop nav, one step per commit:

```
feat(web): add member desktop top-nav item list
feat(web): make member account menu header-ready
feat(web): add desktop top navbar to member site header
feat(web): switch member shell from sidebar to top navbar
docs(web): document member desktop top-nav shell
```

A body when the subject is not enough:

```
refactor(web): drop Tools page desktop intro

Start with the tool cards; nav already labels the page.
```

Tickets:

```
feat(JH-142): add member checkout
fix(MOB-88): prevent double tap on submit
```

```
fix(API-12): reject stale webhook signatures

Replay window is 5 minutes; unsigned retries were still accepted.
```

1chooo.com scopes:

```
feat(bio): restyle work history with company logos
fix(cursor): scale heatmap to the content column
chore(services): remove big money from the navbar
docs: add contributing guide
```

Breaking change:

```
feat(api)!: rename /v1/orders to /v1/checkout

BREAKING CHANGE: clients on /v1/orders must migrate to /v1/checkout.
Old route returns 410.
```
