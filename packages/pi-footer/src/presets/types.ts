export const FOOTER_PRESETS = [
	'minimal',
	'default',
	'power',
	'git-heavy',
] as const;

export type FooterPreset = (typeof FOOTER_PRESETS)[number];

export const STATUS_LABEL_MODES = [
	'smart',
	'always',
	'never',
] as const;

export type StatusLabelMode = (typeof STATUS_LABEL_MODES)[number];

export interface FooterState {
	preset: FooterPreset;
	status_label_mode: StatusLabelMode;
}
