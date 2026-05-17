import type { ExtensionContext } from '@earendil-works/pi-coding-agent';

function get_footer_prompt_status(
	active_base_name: string | undefined,
	active_layers: ReadonlySet<string>,
): string | undefined {
	if (!active_base_name && active_layers.size === 0) {
		return undefined;
	}

	const label = active_base_name ?? 'none';
	const layer_suffix =
		active_layers.size > 0 ? ` +${active_layers.size}` : '';
	return `prompt:${label}${layer_suffix}`;
}

export function set_status(
	ctx: ExtensionContext,
	active_base_name: string | undefined,
	active_layers: ReadonlySet<string>,
): void {
	ctx.ui.setStatus(
		'preset',
		get_footer_prompt_status(active_base_name, active_layers),
	);
}
