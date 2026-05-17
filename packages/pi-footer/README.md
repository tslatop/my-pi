# @spences10/pi-footer

Configurable Pi footer/statusline extension.

It owns `ctx.ui.setFooter(...)` and renders core Pi session data plus
extension statuses published by other extensions with
`ctx.ui.setStatus(...)`.

## Commands

- `/footer` — pick a footer preset with a modal.

## Presets

- `default` — current my-pi-style 2–3 line footer.
- `minimal` — compact cwd/model/context footer.
- `power` — fuller status-forward layout.
- `git-heavy` — emphasizes cwd/git/status widgets.
