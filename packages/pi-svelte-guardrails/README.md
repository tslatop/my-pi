# @spences10/pi-svelte-guardrails

Pi extension that blocks agents from writing discouraged Svelte
patterns.

By default, blocks `$effect` in `.svelte` `write`/`edit` tool calls
and bash writes, then tells the agent to prefer `$derived`, event
handlers, actions, or explicit lifecycle alternatives.

```bash
pi install npm:@spences10/pi-svelte-guardrails
```

This is opt-in: installing the package globally applies it to your Pi
sessions, but projects and downstream users do not inherit it unless
they install the package.

## Configuration

Create `~/.config/my-pi/svelte-guardrails.json` to tune the guardrail
globally, or `.pi/svelte-guardrails.json` in a project to override it
locally:

```json
{
	"blockEffect": true,
	"allow": ["examples/**", "legacy/**"],
	"mode": "block"
}
```

- `blockEffect`: set to `false` to disable the `$effect` rule while
  keeping the extension installed.
- `allow`: glob patterns for paths where the rule is skipped.
- `mode`: `block` prevents the write, `warn` allows it with a warning,
  and `off` skips the rule.

Current default:

```json
{
	"version": 1,
	"blockEffect": true,
	"allow": [],
	"mode": "block"
}
```

Use `block` for strict enforcement, `warn` to observe violations
before enforcing them, and `off` for projects that intentionally allow
the pattern. The current default remains `block`.
