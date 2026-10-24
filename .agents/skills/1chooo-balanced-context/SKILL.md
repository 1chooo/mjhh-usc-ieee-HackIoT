---
name: 1chooo-balanced-context
description: Keep coding-agent context small without dropping evidence that could change the answer. Use when exploring, debugging, reviewing, or implementing code, or when the user asks for balanced token use in Cursor, Grok Build, or another coding agent.
license: MIT
metadata:
  author: 1chooo.com
  version: "1.0.0"
---

# Balanced Context

Finish the task on the evidence that could change the answer. This skill is the reference for how far to look, when to stop, and what to keep. A smaller transcript is a side effect of skipping work that cannot change the result. It is not a target you hit by stopping early.

Follow the repository instructions and the user's authorized scope. Use the tools you already have. Do not install dependencies, configure MCP, add hooks, or change permissions just to apply this skill.

## Start from what you were given

Begin with the paths, symbols, errors, or diffs in the request, and read the repository instructions that apply. A small task in a known file is a direct read. Skip an outline, a plan, and a context tracker when they cost more than opening the file.

Before a lookup, name the uncertainty it should close. Leave routine searches out of the narration.

Search with compact output. Prefer a scoped filename search or `rg -l` to find files, then `rg -n` for the matches you need. Leave dependencies, generated output, binaries, and lockfiles out until the evidence points there. Respect ignore rules, and keep secrets out of tool output.

Use an AST or Tree-sitter outline for structure when one is already available, and LSP or Serena for definitions and references when those are already available. Otherwise search the text. Request paths, symbols, signatures, and locations. Take a full AST dump or a verbose JSON blob only when you are about to process it. Narrow or paginate a result that is too large. Treat a capped or truncated result as incomplete.

## Read enough to explain the behavior

An outline, a signature, or a summary is a map. The source is what runs.

Read the logical unit that matters, whole: its branches, early returns, error handling, and cleanup, plus the imports, types, constants, enclosing control flow, and state that can change that unit. In a large function or component, start at the relevant block and the dependencies it uses. Read the enclosing unit when those interactions are spread out or still unclear. Read a small file whole when that costs less than several partial reads.

Follow a caller or callee when its contract, behavior, or side effects could change the edit. Stop at unrelated dependencies. A shared API or type change means you read the affected consumers and the package boundary. Auth, money, migrations, and destructive operations mean you trace the boundary and the failure paths.

## Widen the search when the uncertainty matters

Read further for an unresolved symbol, a wrapper, a re-export, dynamic dispatch, runtime configuration, conflicting evidence, or a side effect you cannot yet name. Keep verified facts separate from hypotheses. Chase the unknown that could change the implementation, the conclusion, or the validation.

An empty search does not show absence. Check the scope, aliases, ignored paths, and index freshness before you treat a miss as real. LSP references miss some runtime dependencies. When the evidence you need is inaccessible, say so and qualify the conclusion.

**No budget on necessary evidence.** Do not stop a read because of a token cap, a file count, or a read count.

## Stop when four things are accounted for

Proceed when you can name:

1. The current behavior, and the difference the task asks for.
2. The inputs, conditions, outputs, and side effects that matter.
3. The boundaries and consumers the change touches.
4. The validation you will run, and the uncertainty that remains.

Scale that list to the task. Keep going when an open question could materially change the solution. Do not fetch again a fact you have already established.

## Reuse what you already inspected

Use source that is still in the conversation and still current. A summary you remember is not the file. Reconfirm the exact lines before an edit that depends on them. Re-read the affected range after an edit, a branch change, an external change, or a sign the index is stale.

On a long task, or after the context is compacted, keep a short working note: the goal, the verified behavior, the paths and symbols, the decisions and why, the validation, and the open questions. The note gets you back to the source. It does not stand in for it. Skip a tracking file on a routine task, and skip pasting a source excerpt you already have.

## Check the result, then report it

Keep a successful command short, and keep its exit status and the useful summary. Keep the failure message, the stack, and the diagnostic that explains the failure. Open the raw log when a summary hides the cause. A summarized run does not show that every check passed.

Reuse a command result you already have. Rerun it when the code changed, the run failed, or you are no longer sure. Read the final diff. Run the checks the repository requires, and a check that matches the behavior you changed. Widen the tests when something fails or the blast radius is larger than the edit. A required check still runs.

Report the outcome, the validation that mattered, and the limitation that remains, in the user's language. Leave the lookup transcript out. Claim a measured token saving only with comparable usage data. Judge the whole task together: tokens spent, including this skill, retries, and corrections, and whether the result is finished and correct.

For a trial, use similar tasks on the same model and the same settings. Keep this workflow where the retrieval you skipped outweighs the skill itself.

## Anti-patterns

- **Reading the repo to get oriented.** Start from the path, symbol, error, or diff you were given.
- **Treating the map as the run.** An outline, a signature, a search hit, or a remembered summary does not establish runtime behavior.
- **A hard stop.** A token, file, or read budget that cuts off evidence the conclusion still depends on.
- **Proving a negative from one empty search.** Check scope, aliases, ignored paths, and whether the index is fresh.
- **Skipping a required check to stay short.** Widen validation when the failure or the blast radius calls for it.
- **Narrating the search.** Report the outcome, the check that mattered, and what is still unknown.
