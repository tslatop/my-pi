# @spences10/pi-skill-importer

Pi extension and helper API for importing external Agent
Skills-compatible sources into Pi-native skill storage.

The extension registers `/skill-importer` with list/import/sync/delete
flows. It discovers Claude plugin skills, then copies selected skills
into:

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

## Commands

```text
/skill-importer
/skill-importer list
/skill-importer import <key|name>
/skill-importer sync <key|name>
/skill-importer delete <key|name>
```

Review external skills before importing: they can instruct agent
behavior and tool use. Sync refuses to overwrite local edits, and
delete only removes imported Pi-native copies with metadata.

## API

```ts
import {
	scan_importable_skills,
	import_external_skill,
	sync_imported_skill,
	delete_imported_skill,
} from '@spences10/pi-skill-importer';
```

## Development

```bash
pnpm --filter @spences10/pi-skill-importer run check
pnpm --filter @spences10/pi-skill-importer run test
```

## License

MIT
