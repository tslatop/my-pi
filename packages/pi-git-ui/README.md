# @spences10/pi-git-ui

Focused Git staging, diff review, and commit modal for Pi.

## Usage

```bash
pi install npm:@spences10/pi-git-ui
```

Then run:

```text
/git-ui
```

Controls:

- `↑`/`↓` or `j`/`k` — move file selection
- `/` — filter files by path, state, or status code
- `enter` — open contextual actions for the selected file
- `?` — show grouped keyboard help
- `←`/`→` or `h`/`l` — scroll the diff preview
- `n`/`p` — move between diff hunks
- `[`/`]` — move between changed lines
- `space` — safely stage/unstage selected file; disabled for
  partial/conflicted files
- `s` — stage selected file explicitly
- `x` — unstage selected file explicitly
- `S` — stage selected hunk
- `X` — unstage selected hunk
- `+` — stage selected changed line
- `-` — unstage selected changed line
- `c` — commit staged changes with a Conventional Commit helper or raw
  message
- `m` — amend the last commit with staged changes
- `g` — show repository overview with branches, recent commits,
  stashes, and remotes
- `a` — safely stage all; blocked if partial/conflicted files exist
- `A` — force stage all
- `u` — unstage all
- actions menu → `discard file` — confirm and discard unstaged file
  changes
- `r` — refresh
- `esc`/`q` — close
