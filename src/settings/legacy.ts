import { getAgentDir } from '@earendil-works/pi-coding-agent';
// Temporary migration bridge: keep for two minor releases after
// my-pi-settings.json ships, then remove with migrate.ts and related tests.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { type BuiltinExtensionKey } from '../extensions/builtin-registry.js';

export interface LegacyBuiltinExtensionsConfig {
	version?: number;
	enabled?: Partial<Record<BuiltinExtensionKey, boolean>>;
}

export interface LegacySettingsFiles {
	extensions?: {
		path: string;
		config: LegacyBuiltinExtensionsConfig;
	};
	mcpPolicy?: { path: string; config: unknown };
	codingPreferences?: { path: string; config: unknown };
	promptPresets?: { path: string; config: unknown };
	promptPresetState?: { path: string; config: unknown };
	trustedHooks?: { path: string; config: unknown };
	trustedMcpProjects?: { path: string; config: unknown };
	trustedLspBinaries?: { path: string; config: unknown };
	telemetry?: { path: string; config: unknown };
	footer?: { path: string; config: unknown };
	skills?: { path: string; config: unknown };
	svelteGuardrails?: { path: string; config: unknown };
	context?: { path: string; config: unknown };
}

export function get_legacy_builtin_extensions_config_path(): string {
	const xdg =
		process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
	return join(xdg, 'my-pi', 'extensions.json');
}

function read_json_file<T>(path: string): T | undefined {
	if (!existsSync(path)) return undefined;
	return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

function maybe_file<T>(
	path: string,
): { path: string; config: T } | undefined {
	const config = read_json_file<T>(path);
	return config === undefined ? undefined : { path, config };
}

export function find_legacy_settings_files(): LegacySettingsFiles {
	const agent = getAgentDir();
	const xdg =
		process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
	return {
		extensions: maybe_file<LegacyBuiltinExtensionsConfig>(
			get_legacy_builtin_extensions_config_path(),
		),
		mcpPolicy: maybe_file(join(agent, 'mcp-policy.json')),
		codingPreferences: maybe_file(
			join(agent, 'coding-preferences.json'),
		),
		promptPresets: maybe_file(join(agent, 'presets.json')),
		promptPresetState: maybe_file(
			join(agent, 'prompt-preset-state.json'),
		),
		trustedHooks: maybe_file(join(agent, 'trusted-hooks.json')),
		trustedMcpProjects: maybe_file(
			join(agent, 'trusted-mcp-projects.json'),
		),
		trustedLspBinaries: maybe_file(
			join(agent, 'trusted-lsp-binaries.json'),
		),
		telemetry: maybe_file(join(agent, 'telemetry.json')),
		footer: maybe_file(join(agent, 'extensions', 'pi-footer.json')),
		skills: maybe_file(join(xdg, 'my-pi', 'skills.json')),
		svelteGuardrails: maybe_file(
			join(xdg, 'my-pi', 'svelte-guardrails.json'),
		),
		context: maybe_file(join(xdg, 'my-pi', 'context.json')),
	};
}

export function has_legacy_settings_files(): boolean {
	return Object.values(find_legacy_settings_files()).some(Boolean);
}
