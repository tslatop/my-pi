import { create_child_process_env } from '@spences10/pi-child-env';
import { normalize_member_name } from './protocol.js';

interface RpcEnvOptions {
	team_root: string;
	extension_path: string;
}

export function create_rpc_teammate_env(
	options: RpcEnvOptions,
	team_id: string,
	member: string,
	source_env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
	const normalized_member = normalize_member_name(member);
	return create_child_process_env({
		profile: 'team-mode',
		source_env,
		explicit_env: {
			MY_PI_TEAM_MODE_ROOT: options.team_root,
			MY_PI_ACTIVE_TEAM_ID: team_id,
			MY_PI_TEAM_MEMBER: normalized_member,
			MY_PI_TEAM_ROLE: 'teammate',
			MY_PI_TEAM_EXTENSION_PATH: options.extension_path,
		},
	});
}
