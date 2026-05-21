import { getAgentDir } from '@earendil-works/pi-coding-agent';
import {
	read_settings,
	write_settings,
} from '@spences10/pi-settings';
import {
	existsSync,
	mkdirSync,
	renameSync,
	writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { find_legacy_settings_files } from './legacy.js';
import { normalize_settings, type MyPiSettings } from './schema.js';

export interface SettingsMigrationResult {
	migrated: boolean;
	backup_dir?: string;
	moved_files: string[];
	settings: MyPiSettings;
}

function timestamp_for_filename(date = new Date()): string {
	return date.toISOString().replace(/[:.]/g, '-');
}

function backup_path_for(
	original_path: string,
	backup_dir: string,
): string {
	const parent = basename(dirname(original_path));
	return join(backup_dir, `${parent}-${basename(original_path)}`);
}

export function migrate_legacy_settings(): SettingsMigrationResult {
	const legacy = find_legacy_settings_files();
	const entries = Object.values(legacy).filter(
		(entry) => entry !== undefined,
	);
	const settings = read_settings();

	if (legacy.extensions) {
		settings.extensions = {
			...settings.extensions,
			enabled: {
				...settings.extensions?.enabled,
				...legacy.extensions.config.enabled,
			},
		};
	}
	if (legacy.mcpPolicy) {
		settings.mcp = {
			...settings.mcp,
			policy: legacy.mcpPolicy.config,
		};
	}
	if (legacy.codingPreferences) {
		settings.codingPreferences = legacy.codingPreferences.config;
	}
	if (legacy.promptPresets || legacy.promptPresetState) {
		settings.promptPresets = {
			...settings.promptPresets,
			...(legacy.promptPresets && {
				global: legacy.promptPresets.config,
			}),
			...(legacy.promptPresetState && {
				state: legacy.promptPresetState.config,
			}),
		};
	}
	settings.trust = {
		...settings.trust,
		...(legacy.trustedHooks && { hooks: legacy.trustedHooks.config }),
		...(legacy.trustedMcpProjects && {
			mcpProjects: legacy.trustedMcpProjects.config,
		}),
		...(legacy.trustedLspBinaries && {
			lspBinaries: legacy.trustedLspBinaries.config,
		}),
	};
	settings.packages = {
		...settings.packages,
		...(legacy.telemetry && { telemetry: legacy.telemetry.config }),
		...(legacy.footer && { footer: legacy.footer.config }),
		...(legacy.skills && { skills: legacy.skills.config }),
		...(legacy.svelteGuardrails && {
			svelteGuardrails: legacy.svelteGuardrails.config,
		}),
		...(legacy.context && { context: legacy.context.config }),
	};

	write_settings(settings);

	if (entries.length === 0) {
		return {
			migrated: false,
			moved_files: [],
			settings: normalize_settings(settings),
		};
	}

	const backup_dir = join(
		getAgentDir(),
		`legacy-config-backup-${timestamp_for_filename()}`,
	);
	mkdirSync(backup_dir, { recursive: true, mode: 0o700 });

	const moved_files: string[] = [];
	for (const entry of entries) {
		if (!existsSync(entry.path)) continue;
		const target = backup_path_for(entry.path, backup_dir);
		renameSync(entry.path, target);
		moved_files.push(entry.path);
	}

	writeFileSync(
		join(backup_dir, 'migration-report.json'),
		JSON.stringify(
			{
				created_at: new Date().toISOString(),
				settings_path: join(getAgentDir(), 'my-pi-settings.json'),
				moved_files,
			},
			null,
			'\t',
		) + '\n',
		{ mode: 0o600 },
	);

	return {
		migrated: true,
		backup_dir,
		moved_files,
		settings: normalize_settings(settings),
	};
}
