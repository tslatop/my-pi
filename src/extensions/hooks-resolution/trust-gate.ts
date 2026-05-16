import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import {
	resolve_project_trust,
	type ProjectTrustSubject,
} from '@spences10/pi-project-trust';
import { get_hooks_config_info } from './config.js';
import {
	default_hooks_trust_store_path,
	is_hooks_config_trusted,
} from './trust.js';
import type { HooksConfigInfo } from './types.js';

const HOOKS_CONFIG_ENV = 'MY_PI_HOOKS_CONFIG';

export function create_hooks_trust_subject(
	info: HooksConfigInfo,
): ProjectTrustSubject {
	const source_lines = info.sources.map((source) => `- ${source}`);
	const hook_lines =
		info.hooks.length === 0
			? ['- no valid command hooks detected']
			: info.hooks.map((hook) => {
					const matcher = hook.matcher_text
						? ` matcher=${hook.matcher_text}`
						: '';
					return `- ${hook.event_name}${matcher}: ${hook.command}`;
				});
	return {
		kind: 'hooks-config',
		id: info.project_dir,
		store_key: info.project_dir,
		hash: info.hash,
		env_key: HOOKS_CONFIG_ENV,
		prompt_title:
			'Project hook config can execute shell commands after tool use. Trust these hooks?',
		summary_lines: [
			'Sources:',
			...source_lines,
			'Commands:',
			...hook_lines,
		],
		choices: {
			allow_once: 'Allow once for this session',
			trust: 'Trust this repo until hook config changes',
			skip: 'Skip project hooks',
		},
		headless_warning: `Skipping untrusted hook config in ${info.project_dir}. Set ${HOOKS_CONFIG_ENV}=allow to enable hooks for this run.`,
	};
}

export async function should_load_hooks_config(
	cwd: string,
	ctx?: ExtensionContext,
): Promise<boolean> {
	const info = get_hooks_config_info(cwd);
	if (!info) return true;
	if (is_hooks_config_trusted(info.project_dir, info.hash))
		return true;

	const decision = await resolve_project_trust(
		create_hooks_trust_subject(info),
		{
			has_ui: ctx?.hasUI,
			select: ctx?.hasUI
				? async (
						message: string,
						choices: string[],
					): Promise<string> => {
						const selected = await ctx.ui.select(message, choices);
						return selected ?? '';
					}
				: undefined,
			env: process.env,
			trust_store_path: default_hooks_trust_store_path(),
		},
	);
	return (
		decision.action === 'allow-once' ||
		decision.action === 'trust-persisted'
	);
}
