import type {
	ExtensionContext,
	Theme,
} from '@mariozechner/pi-coding-agent';
import { visibleWidth } from '@mariozechner/pi-tui';
import { describe, expect, it } from 'vitest';
import { render_startup_header } from './index.js';

function fake_theme(
	color_mode: ReturnType<Theme['getColorMode']>,
): Theme {
	return {
		bold: (text: string) => text,
		fg: (_color: string, text: string) => text,
		getColorMode: () => color_mode,
	} as unknown as Theme;
}

const truecolor_theme = fake_theme('truecolor');
const plain_theme = fake_theme('256color');

const ctx = {
	cwd: '/repos/state-of-ai-site',
	model: { id: 'gpt-5.5' },
} as ExtensionContext;

describe('render_startup_header', () => {
	it('renders a Davis-style ANSI truecolor title and centered subtitle', () => {
		const colored = render_startup_header(ctx, truecolor_theme, 72);
		const plain = render_startup_header(ctx, plain_theme, 72).join(
			'\n',
		);

		expect(colored.join('\n')).toContain('\x1b[38;2;');
		expect(plain).toContain('██████╗  ██╗');
		expect(plain).toContain('╚═╝      ╚═╝');
		expect(plain).toContain('gpt-5.5 · state-of-ai-site');
		expect(colored.every((line) => visibleWidth(line) <= 72)).toBe(
			true,
		);
	});

	it('uses a compact fallback for narrow terminals', () => {
		const lines = render_startup_header(ctx, truecolor_theme, 12);

		expect(lines).toHaveLength(2);
		expect(lines.join('\n')).toContain('pi');
		expect(lines.every((line) => visibleWidth(line) <= 12)).toBe(
			true,
		);
	});
});
