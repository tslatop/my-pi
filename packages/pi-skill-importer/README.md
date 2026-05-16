# @spences10/pi-skill-importer

Helpers for importing external Agent Skills-compatible sources into
Pi-native skill storage.

This package currently discovers Claude Code user skills and installed
Claude plugin skills, then copies selected skills into:

```text
$PI_CODING_AGENT_DIR/skills/<skill-name>
```

Imported copies include provenance metadata so sync can detect
upstream changes and refuse to overwrite local edits.

## Safety model

External source locations such as `~/.claude/skills` and Claude plugin
caches are treated as upstream sources. The importer only owns copied
Pi-native skills that contain its metadata; it should not delete
upstream Claude/plugin directories.

## API

```ts
import {
	scan_importable_skills,
	import_external_skill,
	sync_imported_skill,
} from '@spences10/pi-skill-importer';
```

## Development

```bash
pnpm --filter @spences10/pi-skill-importer run check
pnpm --filter @spences10/pi-skill-importer run test
```

## License

MIT
