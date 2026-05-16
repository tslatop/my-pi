# @spences10/pi-svelte-guardrails

## 0.0.4

### Patch Changes

- 8944bf8: Move Pi core runtime packages to peer dependencies for
  safer external extension installs.

## 0.0.3

### Patch Changes

- cccaa90: Make Svelte guardrails configurable with effect disabling,
  allowed path globs, defaults, tests, and documentation.
- ec9baf4: Add Svelte guardrail rule modes for blocking, warning,
  disabling, plus project-local config overrides.
- 5d8de6a: Document Svelte guardrails status, disabling options,
  configuration, built-in behavior, and blocked-write semantics.

## 0.0.2

### Patch Changes

- cf3e775: Enable Svelte guardrails by default and clarify blocked
  writes must be retried without $effect.
