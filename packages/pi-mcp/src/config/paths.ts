import { getAgentDir } from '@earendil-works/pi-coding-agent';
import { join } from 'node:path';

export function project_mcp_config_path(cwd: string): string {
	return join(cwd, 'mcp.json');
}

export function project_mcp_policy_path(cwd: string): string {
	return join(cwd, '.pi', 'mcp-policy.json');
}

export function global_mcp_config_path(): string {
	return join(getAgentDir(), 'mcp.json');
}

export function global_mcp_policy_path(): string {
	return join(getAgentDir(), 'mcp-policy.json');
}

export function mcp_backups_dir(): string {
	return join(getAgentDir(), 'mcp-backups');
}

export function mcp_profiles_dir(): string {
	return join(getAgentDir(), 'mcp-profiles');
}

export function timestamp_for_filename(date = new Date()): string {
	return date.toISOString().replace(/[:.]/g, '-');
}

export function safe_profile_name(name: string): string {
	const normalized = name.trim();
	if (!/^[\w-]+$/.test(normalized)) {
		throw new Error(
			'Profile name must use only letters, numbers, underscores, and hyphens',
		);
	}
	return normalized;
}
