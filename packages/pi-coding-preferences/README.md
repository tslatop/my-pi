# @spences10/pi-coding-preferences

[![built with Vite+](https://img.shields.io/badge/built%20with-Vite+-646CFF?logo=vite&logoColor=white)](https://viteplus.dev)
[![tested with Vitest](https://img.shields.io/badge/tested%20with-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev)
[![npm version](https://img.shields.io/npm/v/@spences10/pi-coding-preferences?color=CB3837&logo=npm&logoColor=white)](https://www.npmjs.com/package/@spences10/pi-coding-preferences)
[![license](https://img.shields.io/npm/l/@spences10/pi-coding-preferences)](https://www.npmjs.com/package/@spences10/pi-coding-preferences)

Pi extension that blocks configured coding workflow anti-patterns
before agents run them.

It ships with default workflow preferences. Add user preferences at
`~/.pi/agent/coding-preferences.json` and project preferences at
`.pi/coding-preferences.json`; when either file exists, configured
rules are loaded instead of the built-in defaults.

```json
{
	"rules": [
		{
			"name": "no-npm",
			"toolNames": ["bash"],
			"target": "command",
			"pattern": "^npm\\\\b",
			"reason": "Use pnpm in this repo."
		}
	]
}
```

Rule targets are `command`, `path`, or `input`. Patterns are
JavaScript regular expressions.

```bash
pi install npm:@spences10/pi-coding-preferences
```

This is opt-in: installing the package globally applies it to your Pi
sessions, but projects and downstream users do not inherit it unless
they install the package.

## Development

Package scripts build transitive workspace dependencies first, then
run local tools through Vite+ with `vp exec`.

```bash
pnpm --filter @spences10/pi-coding-preferences run check
pnpm --filter @spences10/pi-coding-preferences run test
pnpm --filter @spences10/pi-coding-preferences run build
```
