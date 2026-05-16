// Confirm destructive tool calls before they run.

import type {
	ExtensionAPI,
	ExtensionContext,
	ToolCallEvent,
	ToolCallEventResult,
	ToolResultEvent,
	UserBashEvent,
	UserBashEventResult,
} from '@earendil-works/pi-coding-agent';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, relative, resolve } from 'node:path';

export interface DestructiveAction {
	title: string;
	description: string;
	reason: string;
	allow_key: string;
}

interface DestructiveCommandPattern {
	pattern: RegExp;
	reason: string;
	allow_key: string;
}

const DESTRUCTIVE_COMMAND_PATTERNS: DestructiveCommandPattern[] = [
	{
		pattern:
			/(^|[;&|]\s*)(npx\s+|pnpx\s+|pnpm\s+exec\s+|bunx\s+)?prisma\s+(migrate\s+reset|db\s+push\b[^;&|]*--force-reset|db\s+execute\b)/,
		reason:
			'Runs a potentially destructive Prisma database operation',
		allow_key: 'bash:prisma-destructive',
	},
	{
		pattern:
			/(^|[;&|]\s*)(psql|mysql|mariadb|sqlite3)\b[^;&|]*\b(drop|delete\s+from|truncate|alter\s+table|update\s+\S+\s+set)\b/i,
		reason: 'Runs destructive SQL through a database CLI',
		allow_key: 'bash:db-cli-destructive-sql',
	},
	{
		pattern:
			/(^|[;&|]\s*)find\b[^;&|]*(\s-delete\b|-exec\s+(sudo\s+)?rm\b)/,
		reason: 'Deletes files found by find',
		allow_key: 'bash:find-delete',
	},
	{
		pattern:
			/(^|[;&|]\s*)git\s+clean\b[^;&|]*-[a-zA-Z]*[fdx][a-zA-Z]*/,
		reason: 'Deletes untracked files or directories',
		allow_key: 'bash:git-clean',
	},
	{
		pattern:
			/(^|[;&|]\s*)git\s+(checkout|restore)\b[^;&|]*(\s--\s+\.\s*$|\s\.\s*$)/,
		reason: 'Discards working tree changes',
		allow_key: 'bash:git-discard-all',
	},
	{
		pattern: /(^|[;&|]\s*)rsync\b[^;&|]*\s--delete\b/,
		reason: 'Deletes destination files during sync',
		allow_key: 'bash:rsync-delete',
	},
	{
		pattern:
			/(^|[;&|]\s*)truncate\b[^;&|]*(\s-s\s*0\b|\s--size\s*=?\s*0\b)/,
		reason: 'Empties file contents',
		allow_key: 'bash:truncate-zero',
	},
	{
		pattern: /(^|[;&|]\s*)dd\b[^;&|]*\bof=/,
		reason: 'Overwrites a device or file with dd',
		allow_key: 'bash:dd-output',
	},
	{
		pattern: /(^|[;&|]\s*)(mkfs|fdisk|parted|wipefs)\b/,
		reason: 'Modifies disks or filesystems',
		allow_key: 'bash:disk-tool',
	},
];

const DESTRUCTIVE_CUSTOM_TOOL_NAME =
	/(^|[_-])(delete|destroy|drop|remove|archive|execute_write_query|execute_schema_query|bulk_insert)([_-]|$)/i;

function preview(value: string, max = 500): string {
	const normalized = value.trim().replace(/\s+/g, ' ');
	return normalized.length > max
		? `${normalized.slice(0, max - 1)}…`
		: normalized;
}

function git(args: string[], cwd: string): string | undefined {
	try {
		return execFileSync('git', ['-C', cwd, ...args], {
			encoding: 'utf-8',
			stdio: ['ignore', 'pipe', 'ignore'],
		}).trim();
	} catch {
		return undefined;
	}
}

function is_git_repo(cwd: string): boolean {
	return git(['rev-parse', '--is-inside-work-tree'], cwd) === 'true';
}

type GitRecoverability =
	| 'tracked-clean'
	| 'tracked-dirty'
	| 'untracked'
	| 'not-git';

function get_git_recoverability(
	cwd: string,
	path: string,
): GitRecoverability {
	if (!is_git_repo(cwd)) return 'not-git';

	const status = git(['status', '--porcelain=v1', '--', path], cwd);
	if (status === undefined) return 'not-git';
	if (status.length > 0) {
		return status.split('\n').some((line) => line.startsWith('??'))
			? 'untracked'
			: 'tracked-dirty';
	}

	const tracked = git(['ls-files', '--', path], cwd);
	return tracked ? 'tracked-clean' : 'untracked';
}

function is_git_recoverable(cwd: string, path: string): boolean {
	return get_git_recoverability(cwd, path) === 'tracked-clean';
}

function is_path_within(parent: string, child: string): boolean {
	const rel = relative(parent, child);
	return Boolean(rel) && !rel.startsWith('..') && !isAbsolute(rel);
}

function is_temp_path(path: string): boolean {
	const temp_root = resolve(tmpdir());
	const absolute = resolve(path);
	return (
		absolute === temp_root || is_path_within(temp_root, absolute)
	);
}

function is_agent_temp_path(path: string): boolean {
	if (!is_temp_path(path)) return false;
	const temp_root = resolve(tmpdir());
	const first_segment = relative(temp_root, resolve(path)).split(
		/[\\/]+/,
	)[0];
	return /^my-pi-(audit|sandbox|temp|tmp|work|session)-/.test(
		first_segment,
	);
}

function parse_shell_words(command: string): string[] {
	const words: string[] = [];
	const pattern = /"((?:\\.|[^"])*)"|'([^']*)'|(\S+)/g;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(command))) {
		words.push(match[1] ?? match[2] ?? match[3]);
	}
	return words;
}

function extract_command_paths(
	command: string,
	command_name: 'rm' | 'git-rm',
): string[] | undefined {
	if (/[;&|`$()<>]/.test(command)) return undefined;
	const words = parse_shell_words(command);
	const command_index =
		command_name === 'rm'
			? words.findIndex((word) =>
					['rm', 'rmdir', 'unlink', 'shred'].includes(word),
				)
			: words.findIndex(
					(word, index) =>
						word === 'rm' && words[index - 1] === 'git',
				);
	if (command_index === -1) return undefined;

	return words
		.slice(command_index + 1)
		.filter((word) => word !== '--' && !word.startsWith('-'));
}

function option_takes_value(
	command_name: string,
	option: string,
): boolean {
	const value_options: Record<string, string[]> = {
		mkdir: ['-m', '--mode', '-Z', '--context'],
		touch: ['-r', '--reference', '-d', '--date', '-t'],
	};
	return value_options[command_name]?.includes(option) ?? false;
}

function extract_simple_create_paths(
	command: string,
	cwd: string,
): string[] {
	if (/[;&|`$()<>]/.test(command)) return [];
	const words = parse_shell_words(command);
	const command_name = words[0];
	if (!['mkdir', 'touch'].includes(command_name)) return [];

	const paths: string[] = [];
	for (let index = 1; index < words.length; index += 1) {
		const word = words[index];
		if (!word || word === '--') continue;
		if (word.startsWith('-')) {
			if (option_takes_value(command_name, word)) index += 1;
			continue;
		}

		const absolute = resolve(cwd, word);
		if (is_temp_path(absolute) && !existsSync(absolute)) {
			paths.push(absolute);
		}
	}
	return paths;
}

function extract_redirect_create_paths(
	command: string,
	cwd: string,
): string[] {
	const paths: string[] = [];
	const pattern =
		/(?:^|\s)(?:[12]>>|>>|&>|[12]?>)(?:\s*)("[^"]+"|'[^']+'|\S+)/g;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(command))) {
		const raw = match[1];
		const path = raw.replace(/^(['"])(.*)\1$/, '$2');
		const absolute = resolve(cwd, path);
		if (is_temp_path(absolute) && !existsSync(absolute)) {
			paths.push(absolute);
		}
	}
	return paths;
}

function extract_bash_create_paths(
	command: string,
	cwd: string,
): string[] {
	return [
		...extract_simple_create_paths(command, cwd),
		...extract_redirect_create_paths(command, cwd),
	];
}

function command_may_create_temp_path(command: string): boolean {
	return /^\s*mktemp\b/.test(command);
}

function text_content(event: ToolResultEvent): string {
	return event.content
		.map((part) => {
			if ('text' in part && typeof part.text === 'string') {
				return part.text;
			}
			return '';
		})
		.join('');
}

function extract_created_temp_paths_from_result(
	event: ToolResultEvent,
): string[] {
	return text_content(event)
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line && is_temp_path(line) && existsSync(line))
		.map((line) => resolve(line));
}

function describe_path_risk(cwd: string, paths: string[]): string {
	const risky = paths.filter(
		(path) => !is_git_recoverable(cwd, path),
	);
	if (risky.length === 0) return 'Deletes git-recoverable files';

	const risks = new Set(
		risky.map((path) => get_git_recoverability(cwd, path)),
	);
	if (risks.has('untracked')) {
		return 'Deletes untracked files or directories that git cannot restore';
	}
	if (risks.has('tracked-dirty')) {
		return 'Deletes files with uncommitted changes';
	}
	return 'Deletes files outside git recovery';
}

function assess_rm_command(
	command: string,
	cwd: string,
	session_created_paths: ReadonlySet<string> = new Set(),
): DestructiveAction | undefined {
	if (
		!/(^|[;&|]\s*)(sudo\s+)?(rm|rmdir|unlink|shred)\b/.test(command)
	) {
		return undefined;
	}

	const paths = extract_command_paths(command, 'rm');
	if (paths && paths.length > 0) {
		if (
			paths.every((path) => {
				const absolute = resolve(cwd, path);
				return (
					session_created_paths.has(absolute) ||
					is_agent_temp_path(absolute)
				);
			})
		) {
			return undefined;
		}
		if (paths.every((path) => is_git_recoverable(cwd, path))) {
			return undefined;
		}
	}

	const reason = paths?.length
		? describe_path_risk(cwd, paths)
		: 'Deletes files or directories';
	return {
		title: 'Confirm destructive command?',
		description: `${reason}: ${preview(command)}`,
		reason,
		allow_key: 'bash:rm-risky',
	};
}

function assess_git_rm_command(
	command: string,
	cwd: string,
): DestructiveAction | undefined {
	if (!/(^|[;&|]\s*)git\s+rm\b/.test(command)) return undefined;
	if (/\s-f\b|\s--force\b/.test(command)) {
		return {
			title: 'Confirm forced git removal?',
			description: `Forced git removal can discard uncommitted file changes: ${preview(command)}`,
			reason: 'Force-removes files from git',
			allow_key: 'bash:git-rm-force',
		};
	}

	const paths = extract_command_paths(command, 'git-rm');
	if (
		paths &&
		paths.length > 0 &&
		paths.every((path) => is_git_recoverable(cwd, path))
	) {
		return undefined;
	}

	const reason = paths?.length
		? describe_path_risk(cwd, paths)
		: 'Deletes tracked files from git';
	return {
		title: 'Confirm git removal?',
		description: `${reason}: ${preview(command)}`,
		reason,
		allow_key: 'bash:git-rm-risky',
	};
}

function assess_git_reset_hard(
	command: string,
	cwd: string,
): DestructiveAction | undefined {
	if (!/(^|[;&|]\s*)git\s+reset\b[^;&|]*--hard\b/.test(command)) {
		return undefined;
	}
	if (git(['status', '--porcelain=v1'], cwd) === '') return undefined;

	return {
		title: 'Confirm hard reset?',
		description: `This can discard uncommitted tracked changes: ${preview(command)}`,
		reason: 'Discards uncommitted tracked changes',
		allow_key: 'bash:git-reset-hard',
	};
}

export function assess_bash_command(
	command: string,
	cwd = process.cwd(),
	session_created_paths: ReadonlySet<string> = new Set(),
): DestructiveAction | undefined {
	const normalized = command.trim();
	if (!normalized) return undefined;

	const specific =
		assess_rm_command(normalized, cwd, session_created_paths) ??
		assess_git_rm_command(normalized, cwd) ??
		assess_git_reset_hard(normalized, cwd);
	if (specific) return specific;

	const match = DESTRUCTIVE_COMMAND_PATTERNS.find(({ pattern }) =>
		pattern.test(normalized),
	);
	if (!match) return undefined;

	return {
		title: 'Confirm destructive command?',
		description: `${match.reason}: ${preview(normalized)}`,
		reason: match.reason,
		allow_key: match.allow_key,
	};
}

function assess_file_write(
	cwd: string,
	path: unknown,
	session_created_paths: ReadonlySet<string> = new Set(),
): DestructiveAction | undefined {
	if (typeof path !== 'string' || !path.trim()) return undefined;
	const absolute = resolve(cwd, path);
	if (!existsSync(absolute)) return undefined;
	if (session_created_paths.has(absolute)) return undefined;
	if (is_git_recoverable(cwd, path)) return undefined;

	const reason =
		get_git_recoverability(cwd, path) === 'tracked-dirty'
			? 'Overwrites a file with uncommitted changes'
			: 'Overwrites an untracked file git cannot restore';

	return {
		title: 'Confirm file overwrite?',
		description: `${reason}: ${path}`,
		reason,
		allow_key: 'write:risky-overwrite',
	};
}

function assess_file_edit(
	cwd: string,
	input: Record<string, unknown>,
	session_created_paths: ReadonlySet<string> = new Set(),
): DestructiveAction | undefined {
	const path =
		typeof input.path === 'string' ? input.path : undefined;
	const edits = Array.isArray(input.edits) ? input.edits : [];
	let removed_chars = 0;
	let added_chars = 0;

	for (const edit of edits) {
		if (!edit || typeof edit !== 'object') continue;
		const old_text = (edit as { oldText?: unknown }).oldText;
		const new_text = (edit as { newText?: unknown }).newText;
		if (typeof old_text === 'string')
			removed_chars += old_text.length;
		if (typeof new_text === 'string') added_chars += new_text.length;
	}

	if (removed_chars === 0 || removed_chars - added_chars < 200) {
		return undefined;
	}
	if (path && session_created_paths.has(resolve(cwd, path))) {
		return undefined;
	}
	if (path && is_git_recoverable(cwd, path)) return undefined;

	return {
		title: 'Confirm large content removal?',
		description: `This edit removes ${removed_chars - added_chars} more characters than it adds${path ? ` in ${path}` : ''}.`,
		reason: path
			? 'Removes substantial content from a file git cannot fully restore'
			: 'Removes substantial file content',
		allow_key: 'edit:large-removal-risky',
	};
}

function assess_custom_tool(
	event: ToolCallEvent,
): DestructiveAction | undefined {
	if (!DESTRUCTIVE_CUSTOM_TOOL_NAME.test(event.toolName)) {
		return undefined;
	}

	const input = event.input as Record<string, unknown>;
	const query =
		typeof input.query === 'string'
			? `\n\nQuery: ${preview(input.query)}`
			: '';

	return {
		title: 'Confirm destructive tool call?',
		description: `Tool ${event.toolName} appears destructive.${query}`,
		reason: `Potentially destructive tool: ${event.toolName}`,
		allow_key: `tool:${event.toolName}`,
	};
}

export function assess_tool_call(
	event: ToolCallEvent,
	cwd: string,
	session_created_paths: ReadonlySet<string> = new Set(),
): DestructiveAction | undefined {
	if (event.toolName === 'bash') {
		const command = (event.input as { command?: unknown }).command;
		return typeof command === 'string'
			? assess_bash_command(command, cwd, session_created_paths)
			: undefined;
	}
	if (event.toolName === 'write') {
		return assess_file_write(
			cwd,
			event.input.path,
			session_created_paths,
		);
	}
	if (event.toolName === 'edit') {
		return assess_file_edit(cwd, event.input, session_created_paths);
	}
	return assess_custom_tool(event);
}

type ConfirmDecision = 'allow' | 'allow-similar' | 'block';

async function confirm_action(
	action: DestructiveAction,
	ctx: ExtensionContext,
): Promise<ConfirmDecision> {
	if (!ctx.hasUI) return 'block';

	const choice = await ctx.ui.select(
		`${action.title}\n${action.description}`,
		['Allow once', 'Allow similar for this session', 'Block'],
	);

	if (choice === 'Allow once') return 'allow';
	if (choice === 'Allow similar for this session') {
		return 'allow-similar';
	}

	ctx.ui.notify('Destructive action blocked', 'info');
	return 'block';
}

function blocked_reason(action: DestructiveAction): string {
	return `Blocked destructive action: ${action.reason}`;
}

function blocked_bash_result(action: DestructiveAction) {
	return {
		output: `${blocked_reason(action)}\n`,
		exitCode: 130,
		cancelled: false,
		truncated: false,
	};
}

export default async function confirm_destructive(pi: ExtensionAPI) {
	const allowed_for_session = new Set<string>();
	const pending_created_files = new Map<string, string>();
	const pending_bash_created_paths = new Map<string, string[]>();
	const bash_may_create_temp_path = new Set<string>();
	const session_created_files = new Set<string>();

	function is_allowed(action: DestructiveAction): boolean {
		return allowed_for_session.has(action.allow_key);
	}

	async function should_allow(
		action: DestructiveAction,
		ctx: ExtensionContext,
	): Promise<boolean> {
		if (is_allowed(action)) return true;

		const decision = await confirm_action(action, ctx);
		if (decision === 'allow-similar') {
			allowed_for_session.add(action.allow_key);
			return true;
		}
		return decision === 'allow';
	}

	pi.on(
		'tool_call',
		async (
			event: ToolCallEvent,
			ctx,
		): Promise<ToolCallEventResult | void> => {
			if (event.toolName === 'write') {
				const path = event.input.path;
				if (typeof path === 'string' && path.trim()) {
					const absolute = resolve(ctx.cwd, path);
					if (!existsSync(absolute)) {
						pending_created_files.set(event.toolCallId, absolute);
					}
				}
			}

			if (event.toolName === 'bash') {
				const command = event.input.command;
				if (typeof command === 'string') {
					const paths = extract_bash_create_paths(command, ctx.cwd);
					if (paths.length > 0) {
						pending_bash_created_paths.set(event.toolCallId, paths);
					}
					if (command_may_create_temp_path(command)) {
						bash_may_create_temp_path.add(event.toolCallId);
					}
				}
			}

			const action = assess_tool_call(
				event,
				ctx.cwd,
				session_created_files,
			);
			if (!action) return;

			if (await should_allow(action, ctx)) return;

			return {
				block: true,
				reason: blocked_reason(action),
			};
		},
	);

	pi.on(
		'tool_result',
		async (event: ToolResultEvent): Promise<void> => {
			const absolute = pending_created_files.get(event.toolCallId);
			if (absolute) {
				pending_created_files.delete(event.toolCallId);
				if (event.toolName === 'write' && !event.isError) {
					session_created_files.add(absolute);
				}
			}

			const bash_paths = pending_bash_created_paths.get(
				event.toolCallId,
			);
			if (bash_paths) {
				pending_bash_created_paths.delete(event.toolCallId);
				if (event.toolName === 'bash' && !event.isError) {
					for (const path of bash_paths) {
						if (existsSync(path)) session_created_files.add(path);
					}
				}
			}

			if (bash_may_create_temp_path.has(event.toolCallId)) {
				bash_may_create_temp_path.delete(event.toolCallId);
				if (event.toolName === 'bash' && !event.isError) {
					for (const path of extract_created_temp_paths_from_result(
						event,
					)) {
						session_created_files.add(path);
					}
				}
			}
		},
	);

	pi.on(
		'user_bash',
		async (
			event: UserBashEvent,
			ctx,
		): Promise<UserBashEventResult | void> => {
			const action = assess_bash_command(
				event.command,
				event.cwd,
				session_created_files,
			);
			if (!action) return;

			if (await should_allow(action, ctx)) return;

			return { result: blocked_bash_result(action) };
		},
	);
}
