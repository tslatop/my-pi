import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';

export type SvelteGuardrailsMode = 'block' | 'warn' | 'off';

export interface SvelteGuardrailsConfig {
	version: 1;
	blockEffect: boolean;
	allow: string[];
	mode: SvelteGuardrailsMode;
}

export const DEFAULT_SVELTE_GUARDRAILS_CONFIG: SvelteGuardrailsConfig =
	{
		version: 1,
		blockEffect: true,
		allow: [],
		mode: 'block',
	};

export function get_svelte_guardrails_config_path(): string {
	if (process.env.MY_PI_SVELTE_GUARDRAILS_CONFIG)
		return process.env.MY_PI_SVELTE_GUARDRAILS_CONFIG;
	const xdg =
		process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
	return join(xdg, 'my-pi', 'svelte-guardrails.json');
}

export function normalize_svelte_guardrails_config(
	value: Partial<SvelteGuardrailsConfig>,
): SvelteGuardrailsConfig {
	return {
		version: 1,
		blockEffect:
			typeof value.blockEffect === 'boolean'
				? value.blockEffect
				: DEFAULT_SVELTE_GUARDRAILS_CONFIG.blockEffect,
		allow: Array.isArray(value.allow)
			? value.allow.filter(
					(item): item is string => typeof item === 'string',
				)
			: DEFAULT_SVELTE_GUARDRAILS_CONFIG.allow,
		mode: is_svelte_guardrails_mode(value.mode)
			? value.mode
			: DEFAULT_SVELTE_GUARDRAILS_CONFIG.mode,
	};
}

export function load_svelte_guardrails_config(): SvelteGuardrailsConfig {
	const path = get_svelte_guardrails_config_path();
	if (!existsSync(path))
		return { ...DEFAULT_SVELTE_GUARDRAILS_CONFIG };

	try {
		return normalize_svelte_guardrails_config(
			JSON.parse(
				readFileSync(path, 'utf-8'),
			) as Partial<SvelteGuardrailsConfig>,
		);
	} catch {
		return { ...DEFAULT_SVELTE_GUARDRAILS_CONFIG };
	}
}

function is_svelte_guardrails_mode(
	value: unknown,
): value is SvelteGuardrailsMode {
	return value === 'block' || value === 'warn' || value === 'off';
}

export function is_path_allowed(
	path: string,
	patterns: readonly string[],
	cwd = process.cwd(),
): boolean {
	const normalized = normalize_path(path, cwd);
	return patterns.some((pattern) =>
		glob_matches(normalized, pattern),
	);
}

function normalize_path(path: string, cwd: string): string {
	const resolved = isAbsolute(path) ? path : resolve(cwd, path);
	return relative(cwd, resolved).replaceAll('\\', '/');
}

function glob_matches(path: string, pattern: string): boolean {
	const normalized_pattern = pattern.replaceAll('\\', '/');
	return glob_to_regexp(normalized_pattern).test(path);
}

function glob_to_regexp(glob: string): RegExp {
	let source = '^';
	for (let i = 0; i < glob.length; i++) {
		const char = glob[i];
		const next = glob[i + 1];
		if (char === '*' && next === '*') {
			const after = glob[i + 2];
			if (after === '/') {
				source += '(?:.*/)?';
				i += 2;
			} else {
				source += '.*';
				i++;
			}
		} else if (char === '*') {
			source += '[^/]*';
		} else {
			source += escape_regexp(char);
		}
	}
	return new RegExp(`${source}$`);
}

function escape_regexp(value: string): string {
	return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}
