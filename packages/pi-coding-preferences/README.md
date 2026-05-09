# @spences10/pi-coding-preferences

Pi extension that blocks configured coding workflow anti-patterns
before agents run them.

It ships with default preferences for Scott's workflow. Add user
preferences at `~/.pi/agent/coding-preferences.json` and project
preferences at `.pi/coding-preferences.json`; when either file exists,
configured rules are loaded instead of the built-in defaults.

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
