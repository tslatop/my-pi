interface RpcCommandOptions {
	extension_path: string;
	model?: string;
	thinking?: string;
	system_prompt?: string;
	tools?: string[];
	skills?: string[];
}

export interface RpcCommand {
	command: string;
	prefix_args: string[];
	disable_builtin_team_mode: boolean;
}

export function is_my_pi_command(value: string): boolean {
	const name = value.split(/[\\/]/).pop()?.toLowerCase();
	return ['my-pi', 'my-pi.js', 'my-pi.cmd', 'my-pi.ps1'].includes(
		name ?? '',
	);
}

export function resolve_rpc_command(
	override: string | undefined,
): RpcCommand {
	if (override?.trim()) {
		const command = override.trim();
		return {
			command,
			prefix_args: [],
			disable_builtin_team_mode: is_my_pi_command(command),
		};
	}
	if (process.argv[1]) {
		return {
			command: process.execPath,
			prefix_args: [process.argv[1]],
			disable_builtin_team_mode: true,
		};
	}
	return {
		command: 'pi',
		prefix_args: [],
		disable_builtin_team_mode: false,
	};
}

export function build_rpc_teammate_args(
	options: RpcCommandOptions,
	session_dir: string,
	command: Pick<
		RpcCommand,
		'prefix_args' | 'disable_builtin_team_mode'
	>,
): string[] {
	const args = [
		...command.prefix_args,
		'--mode',
		'rpc',
		'--session-dir',
		session_dir,
	];
	if (command.disable_builtin_team_mode) args.push('--no-team-mode');
	args.push('-e', options.extension_path);
	if (options.model) args.push('--model', options.model);
	if (options.thinking) args.push('--thinking', options.thinking);
	if (options.system_prompt)
		args.push('--append-system-prompt', options.system_prompt);
	if (options.tools?.length)
		args.push('--tools', options.tools.join(','));
	for (const skill of options.skills ?? [])
		args.push('--skill', skill);
	return args;
}
