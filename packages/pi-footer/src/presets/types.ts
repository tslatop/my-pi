export const FOOTER_PRESETS = [
	'minimal',
	'default',
	'power',
	'git-heavy',
] as const;

export type FooterPreset = (typeof FOOTER_PRESETS)[number];

export const FOOTER_DENSITIES = [
	'compact',
	'comfortable',
	'expanded',
] as const;

export type FooterDensity = (typeof FOOTER_DENSITIES)[number];

export const STATUS_LABEL_MODES = [
	'smart',
	'always',
	'never',
] as const;

export type StatusLabelMode = (typeof STATUS_LABEL_MODES)[number];

export const FOOTER_TONES = ['muted', 'balanced', 'bright'] as const;

export type FooterTone = (typeof FOOTER_TONES)[number];

export const FOOTER_WIDGETS = [
	'path',
	'git',
	'session',
	'model',
	'thinking',
	'context',
	'cost',
	'tokens',
	'statuses',
	'preset',
] as const;

export type FooterWidget = (typeof FOOTER_WIDGETS)[number];

export type FooterWidgetState = Record<FooterWidget, boolean>;

export interface FooterState {
	preset: FooterPreset;
	density: FooterDensity;
	status_label_mode: StatusLabelMode;
	tone: FooterTone;
	widgets: FooterWidgetState;
}

export const DEFAULT_FOOTER_WIDGETS: FooterWidgetState = {
	path: true,
	git: true,
	session: true,
	model: true,
	thinking: true,
	context: true,
	cost: true,
	tokens: true,
	statuses: true,
	preset: true,
};

export const DEFAULT_FOOTER_STATE: FooterState = {
	preset: 'default',
	density: 'comfortable',
	status_label_mode: 'smart',
	tone: 'muted',
	widgets: DEFAULT_FOOTER_WIDGETS,
};
