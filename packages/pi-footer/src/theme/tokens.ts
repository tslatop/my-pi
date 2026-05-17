import type { ExtensionContext } from '@earendil-works/pi-coding-agent';

export type FooterTheme = ExtensionContext['ui']['theme'];

export const FOOTER_COLORS = {
	muted: 'dim',
	path: 'dim',
	stats: 'dim',
	status: 'dim',
	accent: 'accent',
	warning: 'warning',
	error: 'error',
} as const;

export function muted(theme: FooterTheme, text: string): string {
	return theme.fg(FOOTER_COLORS.muted, text);
}

export function warning(theme: FooterTheme, text: string): string {
	return theme.fg(FOOTER_COLORS.warning, text);
}

export function error(theme: FooterTheme, text: string): string {
	return theme.fg(FOOTER_COLORS.error, text);
}
