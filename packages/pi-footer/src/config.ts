import {
	read_package_settings,
	write_package_settings,
} from '@spences10/pi-settings';
import {
	DEFAULT_FOOTER_STATE,
	DEFAULT_FOOTER_WIDGETS,
	FOOTER_DENSITIES,
	FOOTER_PRESETS,
	FOOTER_TONES,
	FOOTER_WIDGETS,
	GIT_ICON_MODES,
	STATUS_LABEL_MODES,
	type FooterState,
} from './presets/types.js';

export function load_footer_state(): FooterState {
	try {
		const parsed = read_package_settings<Partial<FooterState>>(
			'footer',
			{},
		);
		return normalize_footer_state(parsed);
	} catch {
		return clone_default_state();
	}
}

export function save_footer_state(state: FooterState): void {
	write_package_settings('footer', state);
}

export function normalize_footer_state(
	state: Partial<FooterState>,
): FooterState {
	return {
		preset: FOOTER_PRESETS.includes(state.preset as never)
			? state.preset!
			: DEFAULT_FOOTER_STATE.preset,
		density: FOOTER_DENSITIES.includes(state.density as never)
			? state.density!
			: DEFAULT_FOOTER_STATE.density,
		status_label_mode: STATUS_LABEL_MODES.includes(
			state.status_label_mode as never,
		)
			? state.status_label_mode!
			: DEFAULT_FOOTER_STATE.status_label_mode,
		tone: FOOTER_TONES.includes(state.tone as never)
			? state.tone!
			: DEFAULT_FOOTER_STATE.tone,
		git_icon_mode: GIT_ICON_MODES.includes(
			state.git_icon_mode as never,
		)
			? state.git_icon_mode!
			: DEFAULT_FOOTER_STATE.git_icon_mode,
		widgets: {
			...DEFAULT_FOOTER_WIDGETS,
			...Object.fromEntries(
				Object.entries(state.widgets ?? {}).filter(([key]) =>
					FOOTER_WIDGETS.includes(key as never),
				),
			),
		},
	};
}

function clone_default_state(): FooterState {
	return normalize_footer_state(DEFAULT_FOOTER_STATE);
}
