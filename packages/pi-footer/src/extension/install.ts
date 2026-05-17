import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { FooterState } from '../presets/types.js';
import { render_footer_lines } from '../render/footer-lines.js';

export function install_footer(
	ctx: ExtensionContext,
	state: FooterState,
): void {
	if (!ctx.hasUI) return;
	ctx.ui.setFooter((tui, theme, footer_data) => {
		const unsubscribe = footer_data.onBranchChange(() =>
			tui.requestRender(),
		);
		return {
			dispose: unsubscribe,
			invalidate() {},
			render(width: number) {
				return render_footer_lines(
					ctx,
					theme,
					footer_data,
					state,
					width,
				);
			},
		};
	});
}
