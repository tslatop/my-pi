# @spences10/pi-git-ui

Interactive Git staging, diff review, and commit UI for Pi.

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
- `←`/`→` or `h`/`l` — scroll the diff preview
- `n`/`p` — move between diff hunks
- `space` — safely stage/unstage selected file; disabled for
  partial/conflicted files
- `s` — stage selected file explicitly
- `x` — unstage selected file explicitly
- `S` — stage selected hunk
- `X` — unstage selected hunk
- `c` — commit staged changes with a Conventional Commit helper or raw
  message
- `a` — safely stage all; blocked if partial/conflicted files exist
- `A` — force stage all
- `u` — unstage all
- `r` — refresh
- `esc`/`q` — close
