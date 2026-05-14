import { describe, expect, it } from 'vitest';
import {
	command_output,
	has_gh_skill,
	list_github_repository_skills,
	normalize_github_repo_spec,
	parse_gh_skill_install_args,
	run_gh_skill_install,
	run_gh_skill_update,
	type CommandRunner,
} from './gh-skill.js';

describe('gh skill helpers', () => {
	it('detects GitHub repo install args', () => {
		expect(
			parse_gh_skill_install_args([
				'https://github.com/spences10/skills.git',
				'svelte-runes@v1',
				'--pin',
				'v1',
			]),
		).toEqual({
			repository: 'spences10/skills',
			skill: 'svelte-runes@v1',
			flags: ['--pin', 'v1'],
		});
	});

	it('ignores legacy importer args', () => {
		expect(parse_gh_skill_install_args(['svelte-runes'])).toBeNull();
		expect(
			parse_gh_skill_install_args(['plugin:foo', 'svelte-runes']),
		).toBeNull();
	});

	it('normalizes GitHub repo specs', () => {
		expect(
			normalize_github_repo_spec(
				'https://github.com/spences10/skills.git',
			),
		).toBe('spences10/skills');
	});

	it('checks gh skill availability', () => {
		const runner: CommandRunner = (command, args) => ({
			status:
				command === 'gh' && args.join(' ') === 'skill --help' ? 0 : 1,
			stdout: '',
			stderr: '',
		});
		expect(has_gh_skill(runner)).toBe(true);
	});

	it('runs gh skill install for Pi user scope by default', () => {
		const calls: Array<[string, string[]]> = [];
		const runner: CommandRunner = (command, args) => {
			calls.push([command, args]);
			return { status: 0, stdout: 'installed', stderr: '' };
		};
		expect(
			run_gh_skill_install(
				{
					repository: 'spences10/skills',
					skill: 'svelte-runes',
					flags: ['--pin', 'main'],
				},
				runner,
			),
		).toBe('installed');
		expect(calls).toEqual([
			[
				'gh',
				[
					'skill',
					'install',
					'spences10/skills',
					'svelte-runes',
					'--agent',
					'pi',
					'--scope',
					'user',
					'--pin',
					'main',
				],
			],
		]);
	});

	it('does not duplicate scope defaults when caller overrides placement', () => {
		const calls: Array<[string, string[]]> = [];
		const runner: CommandRunner = (command, args) => {
			calls.push([command, args]);
			return { status: 0, stdout: 'installed', stderr: '' };
		};
		run_gh_skill_install(
			{
				repository: 'spences10/skills',
				skill: 'svelte-runes',
				flags: ['--scope', 'project'],
			},
			runner,
		);
		expect(calls[0]?.[1]).toEqual([
			'skill',
			'install',
			'spences10/skills',
			'svelte-runes',
			'--agent',
			'pi',
			'--scope',
			'project',
		]);
	});

	it('lists skills from a GitHub repository tree', () => {
		const calls: Array<[string, string[]]> = [];
		const runner: CommandRunner = (command, args) => {
			calls.push([command, args]);
			if (args[1] === 'repos/spences10/skills') {
				return {
					status: 0,
					stdout: JSON.stringify({ default_branch: 'main' }),
					stderr: '',
				};
			}
			return {
				status: 0,
				stdout: JSON.stringify({
					tree: [
						{ path: 'svelte-runes/SKILL.md', type: 'blob' },
						{ path: 'svelte-runes/README.md', type: 'blob' },
						{ path: 'nested/tdd/SKILL.md', type: 'blob' },
					],
				}),
				stderr: '',
			};
		};
		expect(
			list_github_repository_skills(
				'spences10/skills',
				undefined,
				runner,
			),
		).toEqual([
			{ name: 'tdd', path: 'nested/tdd/SKILL.md' },
			{ name: 'svelte-runes', path: 'svelte-runes/SKILL.md' },
		]);
		expect(calls).toEqual([
			['gh', ['api', 'repos/spences10/skills']],
			[
				'gh',
				[
					'api',
					'--method',
					'GET',
					'repos/spences10/skills/git/trees/main',
					'-f',
					'recursive=1',
				],
			],
		]);
	});

	it('runs gh skill update with passthrough args', () => {
		const calls: Array<[string, string[]]> = [];
		const runner: CommandRunner = (command, args) => {
			calls.push([command, args]);
			return { status: 0, stdout: '', stderr: 'up to date' };
		};
		expect(run_gh_skill_update(['--dry-run'], runner)).toBe(
			'up to date',
		);
		expect(calls).toEqual([['gh', ['skill', 'update', '--dry-run']]]);
	});

	it('combines command output', () => {
		expect(
			command_output({ status: 0, stdout: 'out\n', stderr: 'err\n' }),
		).toBe('out\nerr');
	});
});
