import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type {
	HookEventName,
	HooksConfigInfo,
	HookState,
	JsonValue,
	ResolvedCommandHook,
} from './types.js';

export function is_file(path: string): boolean {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
}

export function as_record(
	value: unknown,
): Record<string, unknown> | undefined {
	if (typeof value !== 'object' || value === null) return undefined;
	return value as Record<string, unknown>;
}

export function walk_up_directories(
	start_dir: string,
	stop_dir?: string,
): string[] {
	const directories: string[] = [];
	const has_stop_dir = stop_dir !== undefined;
	let current = resolve(start_dir);
	let parent = dirname(current);
	let reached_stop_dir = has_stop_dir && current === stop_dir;
	let reached_filesystem_root = parent === current;

	directories.push(current);
	while (!reached_stop_dir && !reached_filesystem_root) {
		current = parent;
		parent = dirname(current);
		reached_stop_dir = has_stop_dir && current === stop_dir;
		reached_filesystem_root = parent === current;
		directories.push(current);
	}

	return directories;
}

export function find_nearest_git_root(
	start_dir: string,
): string | undefined {
	for (const directory of walk_up_directories(start_dir)) {
		if (existsSync(join(directory, '.git'))) {
			return directory;
		}
	}
	return undefined;
}

export function has_hooks_config(directory: string): boolean {
	return (
		is_file(join(directory, '.claude', 'settings.json')) ||
		is_file(join(directory, '.rulesync', 'hooks.json')) ||
		is_file(join(directory, '.pi', 'hooks.json'))
	);
}

export function find_project_dir(cwd: string): string {
	const git_root = find_nearest_git_root(cwd);
	for (const directory of walk_up_directories(cwd, git_root)) {
		if (has_hooks_config(directory)) {
			return directory;
		}
	}
	return git_root ?? resolve(cwd);
}

export function read_json_file(path: string): JsonValue | undefined {
	if (!is_file(path)) return undefined;
	try {
		return JSON.parse(readFileSync(path, 'utf8')) as JsonValue;
	} catch {
		return undefined;
	}
}

export function resolve_hook_command(
	command: string,
	project_dir: string,
): string {
	return command.replace(/\$CLAUDE_PROJECT_DIR\b/g, project_dir);
}

export function compile_matcher(
	matcher_text: string | undefined,
): RegExp | undefined {
	if (matcher_text === undefined) return undefined;
	try {
		return new RegExp(matcher_text);
	} catch {
		return undefined;
	}
}

export function create_hook(
	event_name: HookEventName,
	matcher_text: string | undefined,
	command: string,
	source: string,
	project_dir: string,
): ResolvedCommandHook | undefined {
	const matcher = compile_matcher(matcher_text);
	if (matcher_text !== undefined && matcher === undefined)
		return undefined;
	return {
		event_name,
		matcher,
		matcher_text,
		command: resolve_hook_command(command, project_dir),
		source,
	};
}

export function get_hook_entries(
	hooks_record: Record<string, unknown>,
	event_name: HookEventName,
): unknown[] {
	const keys =
		event_name === 'PreToolUse'
			? ['PreToolUse', 'preToolUse']
			: event_name === 'PostToolUse'
				? ['PostToolUse', 'postToolUse']
				: ['PostToolUseFailure', 'postToolUseFailure'];

	for (const key of keys) {
		const value = hooks_record[key];
		if (Array.isArray(value)) return value;
	}
	return [];
}

export function parse_claude_settings_hooks(
	config: unknown,
	source: string,
	project_dir: string,
): ResolvedCommandHook[] {
	const root = as_record(config);
	const hooks_root = root ? as_record(root.hooks) : undefined;
	if (!hooks_root) return [];

	const hooks: ResolvedCommandHook[] = [];
	const events: HookEventName[] = [
		'PreToolUse',
		'PostToolUse',
		'PostToolUseFailure',
	];

	for (const event_name of events) {
		const entries = get_hook_entries(hooks_root, event_name);
		for (const entry of entries) {
			const entry_record = as_record(entry);
			if (!entry_record || !Array.isArray(entry_record.hooks))
				continue;

			const matcher_text =
				typeof entry_record.matcher === 'string'
					? entry_record.matcher
					: undefined;
			for (const nested_hook of entry_record.hooks) {
				const nested_record = as_record(nested_hook);
				if (!nested_record) continue;
				if (nested_record.type !== 'command') continue;
				if (typeof nested_record.command !== 'string') continue;

				const hook = create_hook(
					event_name,
					matcher_text,
					nested_record.command,
					source,
					project_dir,
				);
				if (hook) hooks.push(hook);
			}
		}
	}

	return hooks;
}

export function parse_simple_hooks_file(
	config: unknown,
	source: string,
	project_dir: string,
): ResolvedCommandHook[] {
	const root = as_record(config);
	const hooks_root = root ? as_record(root.hooks) : undefined;
	if (!hooks_root) return [];

	const hooks: ResolvedCommandHook[] = [];
	const events: HookEventName[] = [
		'PreToolUse',
		'PostToolUse',
		'PostToolUseFailure',
	];

	for (const event_name of events) {
		const entries = get_hook_entries(hooks_root, event_name);
		for (const entry of entries) {
			const entry_record = as_record(entry);
			if (!entry_record || typeof entry_record.command !== 'string') {
				continue;
			}

			const matcher_text =
				typeof entry_record.matcher === 'string'
					? entry_record.matcher
					: undefined;
			const hook = create_hook(
				event_name,
				matcher_text,
				entry_record.command,
				source,
				project_dir,
			);
			if (hook) hooks.push(hook);
		}
	}

	return hooks;
}

function hook_config_paths(project_dir: string): string[] {
	return [
		join(project_dir, '.claude', 'settings.json'),
		join(project_dir, '.rulesync', 'hooks.json'),
		join(project_dir, '.pi', 'hooks.json'),
	];
}

function parse_hooks_config_file(
	path: string,
	project_dir: string,
): ResolvedCommandHook[] {
	const config = read_json_file(path);
	if (config === undefined) return [];
	if (path.endsWith(join('.claude', 'settings.json'))) {
		return parse_claude_settings_hooks(config, path, project_dir);
	}
	return parse_simple_hooks_file(config, path, project_dir);
}

export function load_hooks(cwd: string): HookState {
	const project_dir = find_project_dir(cwd);
	const hooks = hook_config_paths(project_dir).flatMap((path) =>
		parse_hooks_config_file(path, project_dir),
	);

	return { project_dir, hooks };
}

export function get_hooks_config_info(
	cwd: string,
): HooksConfigInfo | undefined {
	const project_dir = find_project_dir(cwd);
	const sources = hook_config_paths(project_dir).filter(is_file);
	if (sources.length === 0) return undefined;

	const hash = createHash('sha256');
	for (const source of sources) {
		hash.update(source);
		hash.update('\0');
		hash.update(readFileSync(source, 'utf8'));
		hash.update('\0');
	}

	const hooks = sources
		.flatMap((source) => parse_hooks_config_file(source, project_dir))
		.map((hook) => ({
			event_name: hook.event_name,
			matcher_text: hook.matcher_text,
			command: hook.command,
			source: hook.source,
		}));

	return {
		project_dir,
		hash: hash.digest('hex'),
		sources,
		hooks,
	};
}
