# @spences10/pi-svelte-guardrails

Pi extension that blocks agents from writing discouraged Svelte
patterns.

Currently blocks `$effect` in `.svelte` `write`/`edit` tool calls and
tells the agent to prefer `$derived`, event handlers, actions, or
explicit lifecycle alternatives.

```bash
pi install npm:@spences10/pi-svelte-guardrails
```

This is opt-in: installing the package globally applies it to your Pi
sessions, but projects and downstream users do not inherit it unless
they install the package.
