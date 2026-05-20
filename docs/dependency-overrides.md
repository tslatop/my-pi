# Dependency overrides

`pnpm-workspace.yaml` contains repo-wide `overrides` for transitive dependencies. These are intentionally excluded from normal Renovate update PRs in `renovate.json` because they are temporary/security pins, not direct project dependencies.

## Current overrides

| Package | Pin | Why | Current path | Removal condition |
| --- | --- | --- | --- | --- |
| `basic-ftp` | `5.3.1` | Previously fixed `pnpm audit` high severity for `basic-ftp <=5.2.2`. | Not currently present in `pnpm why`; kept from the audit-fix set pending a clean removal check. | Remove if `pnpm install --lockfile-only` and `pnpm audit --audit-level low` stay clean without it. |
| `fast-xml-parser` | `5.7.2` | Fixed `pnpm audit` moderate severity for `fast-xml-parser <5.7.0`. | `@earendil-works/pi-ai` → `@aws-sdk/client-bedrock-runtime` / AWS SDK XML builder. | Remove when upstream AWS SDK / Pi dependency resolves to a safe version without an override. |
| `postcss` | `8.5.12` | Fixed `pnpm audit` moderate severity for `postcss <8.5.10`. | Web/dev tooling: `vite`, `vite-plus`, `shadcn-svelte`. | Remove when direct/tooling dependencies resolve to a safe version without an override. |
| `protobufjs` | `7.5.8` | Fixes current `pnpm audit` protobufjs advisories (`<=7.5.7`). | `@earendil-works/pi-ai` → `@google/genai`. | Remove when `@google/genai` / Pi dependency resolves to a safe version without an override. |
| `miniflare>ws` | `8.20.1` | Fixes current `pnpm audit` moderate severity for `ws >=8.0.0 <8.20.1`. Scoped to avoid changing unrelated `ws` users. | `apps/web` → `wrangler` / `miniflare`. | Remove when Cloudflare tooling resolves to a safe version without an override. |
| `@sveltejs/kit>cookie` | `0.7.0` | Fixes current `pnpm audit` low severity for `cookie <0.7.0`. Scoped to avoid downgrading unrelated `cookie` users. | `apps/web` → `@sveltejs/kit`. | Remove when SvelteKit resolves to a safe version without an override. |

## Audit/removal checklist

For each override, test removal deliberately:

1. Remove one override from `pnpm-workspace.yaml`.
2. Run `pnpm install --lockfile-only`.
3. Run `pnpm audit --audit-level low`.
4. Run the project check/test command if the lockfile changed materially.
5. If clean, commit the override removal. If not, keep the pin and update this document.
