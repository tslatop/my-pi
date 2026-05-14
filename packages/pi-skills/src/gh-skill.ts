import { spawnSync } from 'node:child_process';

export interface CommandResult {
	status: number | null;
	stdout: string;
	stderr: string;
	error?: Error;
}

export type CommandRunner = (
	command: string,
	args: string[],
) => CommandResult;

export const default_runner: CommandRunner = (command, args) => {
	const result = spawnSync(command, args, {
		encoding: 'utf-8',
		windowsHide: true,
	});
	return {
		status: result.status,
		stdout: result.stdout ?? '',
		stderr: result.stderr ?? '',
		error: result.error,
	};
};

export function command_output(result: CommandResult): string {
	return [result.stdout.trim(), result.stderr.trim()]
		.filter(Boolean)
		.join('\n');
}

export function ensure_success(
	result: CommandResult,
	fallback: string,
): string {
	if (result.status === 0) return command_output(result);
	const output = command_output(result);
	if (result.error) {
		throw new Error(`${fallback}: ${result.error.message}`);
	}
	throw new Error(output || fallback);
}

export function has_gh_skill(
	runner: CommandRunner = default_runner,
): boolean {
	const result = runner('gh', ['skill', '--help']);
	return result.status === 0;
}

export function is_github_repo_spec(value: string): boolean {
	return /^(?:https:\/\/github\.com\/)?[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(
		value,
	);
}

export function normalize_github_repo_spec(value: string): string {
	return value
		.replace(/^https:\/\/github\.com\//, '')
		.replace(/\.git$/, '');
}

function parse_repo_parts(repository: string): {
	owner: string;
	repo: string;
} {
	const normalized = normalize_github_repo_spec(repository);
	const [owner, repo] = normalized.split('/');
	if (!owner || !repo) {
		throw new Error(`Invalid GitHub repository: ${repository}`);
	}
	return { owner, repo };
}

export interface GhSkillInstallRequest {
	repository: string;
	skill: string;
	flags: string[];
}

export function parse_gh_skill_install_args(
	parts: string[],
): GhSkillInstallRequest | null {
	if (parts.length < 2) return null;
	const [repository, skill, ...flags] = parts;
	if (!repository || !skill || !is_github_repo_spec(repository)) {
		return null;
	}
	return {
		repository: normalize_github_repo_spec(repository),
		skill,
		flags,
	};
}

function has_flag(flags: string[], name: string): boolean {
	return flags.some(
		(flag) => flag === name || flag.startsWith(`${name}=`),
	);
}

export function run_gh_skill_install(
	request: GhSkillInstallRequest,
	runner: CommandRunner = default_runner,
): string {
	const default_flags: string[] = [];
	if (
		!has_flag(request.flags, '--agent') &&
		!has_flag(request.flags, '--dir')
	) {
		default_flags.push('--agent', 'pi');
	}
	if (
		!has_flag(request.flags, '--scope') &&
		!has_flag(request.flags, '--dir')
	) {
		default_flags.push('--scope', 'user');
	}
	const args = [
		'skill',
		'install',
		normalize_github_repo_spec(request.repository),
		request.skill,
		...default_flags,
		...request.flags,
	];
	return ensure_success(
		runner('gh', args),
		'gh skill install failed',
	);
}

export interface GhRepositorySkill {
	name: string;
	path: string;
}

interface GitHubRepositoryResponse {
	default_branch?: string;
}

interface GitHubTreeResponse {
	tree?: Array<{ path?: string; type?: string }>;
}

export function list_github_repository_skills(
	repository: string,
	ref?: string,
	runner: CommandRunner = default_runner,
): GhRepositorySkill[] {
	const { owner, repo } = parse_repo_parts(repository);
	let tree_ref = ref?.trim();
	if (!tree_ref) {
		const repo_output = ensure_success(
			runner('gh', ['api', `repos/${owner}/${repo}`]),
			'gh api failed while reading repository metadata',
		);
		const metadata = JSON.parse(
			repo_output,
		) as GitHubRepositoryResponse;
		tree_ref = metadata.default_branch || 'HEAD';
	}

	const tree_output = ensure_success(
		runner('gh', [
			'api',
			`repos/${owner}/${repo}/git/trees/${tree_ref}`,
			'-f',
			'recursive=1',
		]),
		'gh api failed while listing repository skills',
	);
	const tree = JSON.parse(tree_output) as GitHubTreeResponse;
	return (tree.tree ?? [])
		.filter(
			(item) =>
				item.type === 'blob' && item.path?.endsWith('/SKILL.md'),
		)
		.map((item) => {
			const path = item.path!;
			return {
				path,
				name: path.split('/').at(-2) ?? path,
			};
		})
		.sort((a, b) => a.path.localeCompare(b.path));
}

export function run_gh_skill_update(
	args: string[],
	runner: CommandRunner = default_runner,
): string {
	return ensure_success(
		runner('gh', ['skill', 'update', ...args]),
		'gh skill update failed',
	);
}
