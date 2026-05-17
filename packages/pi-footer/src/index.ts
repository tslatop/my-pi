import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { register_footer_command } from './commands/footer-command.js';
import { install_footer } from './extension/install.js';
import { type FooterState } from './presets/types.js';

export {
	get_current_thinking_level,
	get_default_footer_thinking_level,
} from './model/thinking.js';
export {
	FOOTER_PRESETS,
	type FooterPreset,
} from './presets/types.js';
export { FOOTER_RESEARCH_REFERENCES } from './reference/research.js';
export { render_footer_lines } from './render/footer-lines.js';
export { render_footer_status_line } from './render/status-line.js';
export { FOOTER_COLORS, type FooterTheme } from './theme/tokens.js';

const state: FooterState = {
	preset: 'default',
	status_label_mode: 'smart',
	tone: 'muted',
};

export default function footer_extension(pi: ExtensionAPI): void {
	register_footer_command(pi, state);

	pi.on('session_start', async (_event, ctx) => {
		install_footer(ctx, state);
	});

	pi.on('session_shutdown', async (_event, ctx) => {
		ctx.ui.setFooter(undefined);
	});
}
