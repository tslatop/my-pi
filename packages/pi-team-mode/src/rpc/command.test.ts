import { describe, expect, it } from 'vitest';
import {
	build_rpc_teammate_args,
	is_my_pi_command,
	resolve_rpc_command,
} from './command.js';

describe('RPC command helpers', () => {
	it('detects my-pi command names across executable variants', () => {
		expect(is_my_pi_command('/repo/bin/my-pi')).toBe(true);
		expect(is_my_pi_command('C:\\tools\\my-pi.cmd')).toBe(true);
		expect(is_my_pi_command('/repo/bin/pi')).toBe(false);
	});

	it('resolves explicit commands and disables built-in team mode for my-pi', () => {
		expect(resolve_rpc_command(' /repo/bin/my-pi ')).toEqual({
			command: '/repo/bin/my-pi',
			prefix_args: [],
			disable_builtin_team_mode: true,
		});
	});

	it('builds teammate RPC args with extension, model, tools, and skills', () => {
		const args = build_rpc_teammate_args(
			{
				extension_path: '/tmp/team-extension.js',
				model: 'anthropic/claude-sonnet-4-5',
				thinking: 'high',
				system_prompt: 'Use the reviewer profile.',
				tools: ['read', 'bash'],
				skills: ['research'],
			},
			'/tmp/team-session',
			{
				prefix_args: ['/repo/dist/index.js'],
				disable_builtin_team_mode: true,
			},
		);

		expect(args).toEqual([
			'/repo/dist/index.js',
			'--mode',
			'rpc',
			'--session-dir',
			'/tmp/team-session',
			'--no-team-mode',
			'-e',
			'/tmp/team-extension.js',
			'--model',
			'anthropic/claude-sonnet-4-5',
			'--thinking',
			'high',
			'--append-system-prompt',
			'Use the reviewer profile.',
			'--tools',
			'read,bash',
			'--skill',
			'research',
		]);
	});
});
