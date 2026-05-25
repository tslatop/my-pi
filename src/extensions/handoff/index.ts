// Handoff extension — zero-context help for Pi continuation primitives.

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export const HANDOFF_GUIDE = `Handoff in Pi

Use built-ins first:
- /fork: exact-context branch for experiments or continuing in a fresh session
- /tree: inspect/navigate conversation branches
- /export and /import: move session data between Pi instances
- /share: create a shareable session artifact

Use a markdown handoff only when the recipient is outside Pi or needs a compact task/return brief.
Return brief: changed files, validation, risks, next action.`;

export function handoff_command_output(args: string): string {
	const trimmed = args.trim();
	if (!trimmed) return HANDOFF_GUIDE;
	return `${HANDOFF_GUIDE}\n\nIntent noted: ${trimmed}`;
}

export default function handoff(pi: ExtensionAPI): void {
	pi.registerCommand('handoff', {
		description:
			'Show when to use /fork, /tree, /export, /import, /share, or a portable handoff',
		handler: async (args, ctx) => {
			ctx.ui.notify(handoff_command_output(args), 'info');
		},
	});
}
