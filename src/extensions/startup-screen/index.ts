import type {
	ExtensionAPI,
	ExtensionContext,
	Theme,
	ThemeColor,
} from '@earendil-works/pi-coding-agent';
import {
	truncateToWidth,
	visibleWidth,
} from '@earendil-works/pi-tui';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

type Rgb = [number, number, number];

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const TRUECOLOR_FG_PREFIX = '\x1b[38;2;';
const XTERM_FG_PREFIX = '\x1b[38;5;';

const FALLBACK_PALETTE: Rgb[] = [
	[22, 83, 189],
	[48, 129, 247],
	[93, 171, 255],
	[151, 205, 255],
	[93, 171, 255],
	[48, 129, 247],
];

const THEME_GRADIENT_TOKENS: ThemeColor[] = [
	'accent',
	'borderAccent',
	'mdHeading',
	'syntaxFunction',
	'thinkingHigh',
	'mdCode',
];

const XTERM_CUBE_VALUES = [0, 95, 135, 175, 215, 255] as const;
const XTERM_GRAY_START = 232;

const TITLE_LINES = [
	'███╗   ███╗                  ██████╗ ██╗',
	'████╗ ████║ ██╗   ██╗        ██╔══██╗   ',
	'██╔████╔██║ ╚██╗ ██╔╝ ████╗  ██████╔╝██╗',
	'██║╚██╔╝██║  ╚████╔╝ ╚═══╝   ██╔═══╝ ██║',
	'██║ ╚═╝ ██║   ╚██╔╝          ██║     ██║',
	'╚═╝     ╚═╝   ██╔╝           ╚═╝     ╚═╝',
] as const;

const TITLE_WIDTH = Math.max(
	...TITLE_LINES.map((line) => line.length),
);

function read_my_pi_version(): string {
	const candidates = [
		new URL('../../../package.json', import.meta.url),
		new URL('../package.json', import.meta.url),
	];

	for (const candidate of candidates) {
		try {
			const parsed: unknown = JSON.parse(
				readFileSync(candidate, 'utf-8'),
			);
			const version = (parsed as { version?: unknown } | null)
				?.version;
			if (typeof version === 'string') return version;
		} catch {
			// Try the next source/distro-relative location.
		}
	}

	return 'dev';
}

const MY_PI_VERSION = read_my_pi_version();

function mix(a: number, b: number, t: number): number {
	return Math.round(a + (b - a) * t);
}

function sample_gradient(position: number, palette: Rgb[]): Rgb {
	const wrapped = ((position % 1) + 1) % 1;
	const scaled = wrapped * palette.length;
	const index = Math.floor(scaled);
	const next_index = (index + 1) % palette.length;
	const t = scaled - index;
	const a = palette[index]!;
	const b = palette[next_index]!;
	return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
}

function ansi_fg([r, g, b]: Rgb, text: string): string {
	return `\x1b[38;2;${r};${g};${b}m${text}${RESET}`;
}

function rgb_from_xterm(index: number): Rgb | undefined {
	if (index < 0 || index > 255) return undefined;
	if (index < 16) return undefined;
	if (index >= XTERM_GRAY_START) {
		const gray = 8 + (index - XTERM_GRAY_START) * 10;
		return [gray, gray, gray];
	}

	const cube = index - 16;
	const r = XTERM_CUBE_VALUES[Math.floor(cube / 36)]!;
	const g = XTERM_CUBE_VALUES[Math.floor((cube % 36) / 6)]!;
	const b = XTERM_CUBE_VALUES[cube % 6]!;
	return [r, g, b];
}

function ansi_params(
	ansi: string,
	prefix: string,
): string[] | undefined {
	if (!ansi.startsWith(prefix)) return undefined;
	const end = ansi.indexOf('m', prefix.length);
	if (end === -1) return undefined;
	return ansi.slice(prefix.length, end).split(';');
}

function rgb_from_ansi(ansi: string): Rgb | undefined {
	const truecolor = ansi_params(ansi, TRUECOLOR_FG_PREFIX);
	if (truecolor?.length === 3) {
		return [
			Number(truecolor[0]),
			Number(truecolor[1]),
			Number(truecolor[2]),
		];
	}

	const xterm = ansi_params(ansi, XTERM_FG_PREFIX);
	return xterm?.length === 1
		? rgb_from_xterm(Number(xterm[0]))
		: undefined;
}

function theme_gradient_palette(theme: Theme): Rgb[] {
	const palette: Rgb[] = [];
	const seen = new Set<string>();

	for (const token of THEME_GRADIENT_TOKENS) {
		const rgb = rgb_from_ansi(theme.getFgAnsi(token));
		if (!rgb) continue;
		const key = rgb.join(',');
		if (seen.has(key)) continue;
		seen.add(key);
		palette.push(rgb);
	}

	return palette.length >= 2 ? palette : FALLBACK_PALETTE;
}

function gradient_text(
	text: string,
	phase: number,
	palette: Rgb[],
): string {
	const chars = text.split('');
	const span = Math.max(chars.length - 1, 1);
	return chars
		.map((char, index) => {
			if (char === ' ') return char;
			return ansi_fg(
				sample_gradient(index / span + phase, palette),
				char,
			);
		})
		.join('');
}

function center_line(line: string, width: number): string {
	const clipped =
		visibleWidth(line) > width
			? truncateToWidth(line, width, '')
			: line;
	const padding = Math.max(
		0,
		Math.floor((width - visibleWidth(clipped)) / 2),
	);
	return `${' '.repeat(padding)}${clipped}`;
}

function color_line(
	theme: Theme,
	palette: Rgb[],
	line: string,
	phase: number,
): string {
	return theme.getColorMode() === 'truecolor'
		? gradient_text(line, phase, palette)
		: theme.fg('accent', line);
}

function gradient_or_theme(
	theme: Theme,
	palette: Rgb[],
	line: string,
	phase: number,
): string {
	return theme.getColorMode() === 'truecolor'
		? `${BOLD}${gradient_text(line, phase, palette)}${RESET}`
		: theme.bold(theme.fg('accent', line));
}

function render_brand(
	theme: Theme,
	palette: Rgb[],
	width: number,
): string {
	return gradient_or_theme(
		theme,
		palette,
		center_line(`My-Pi v${MY_PI_VERSION}`, width),
		0.12,
	);
}

function render_subtitle(
	ctx: ExtensionContext,
	theme: Theme,
	palette: Rgb[],
	model_id: string,
	width: number,
): string {
	const project = basename(ctx.cwd) || ctx.cwd;
	const subtitle = center_line(`${model_id} · ${project}`, width);
	return gradient_or_theme(theme, palette, subtitle, 0.18);
}

export function render_startup_header(
	ctx: ExtensionContext,
	theme: Theme,
	width: number,
	model_id = ctx.model?.id ?? 'no model selected',
): string[] {
	if (width < 24) {
		return [
			center_line(
				theme.bold(theme.fg('accent', `My-Pi v${MY_PI_VERSION}`)),
				width,
			),
			center_line(
				`${model_id} · ${basename(ctx.cwd) || ctx.cwd}`,
				width,
			),
		];
	}

	const palette = theme_gradient_palette(theme);
	const logo = TITLE_LINES.map((line, row) =>
		color_line(
			theme,
			palette,
			center_line(line.padEnd(TITLE_WIDTH), width),
			row * 0.045,
		),
	);

	return [
		'',
		render_brand(theme, palette, width),
		...logo,
		render_subtitle(ctx, theme, palette, model_id, width),
		'',
	];
}

export default function startup_screen_extension(
	pi: ExtensionAPI,
): void {
	let request_render: (() => void) | undefined;
	let current_model_id = 'no model selected';

	function install_header(ctx: ExtensionContext): void {
		ctx.ui.setHeader((tui, theme) => {
			request_render = () => tui.requestRender();
			return {
				invalidate() {
					tui.requestRender();
				},
				render(width: number) {
					return render_startup_header(
						ctx,
						theme,
						width,
						current_model_id,
					);
				},
			};
		});
	}

	pi.on('session_start', async (_event, ctx) => {
		current_model_id = ctx.model?.id ?? 'no model selected';
		if (!ctx.hasUI) return;
		install_header(ctx);
	});

	pi.on('model_select', (event) => {
		current_model_id = event.model.id;
		request_render?.();
	});

	pi.on('session_shutdown', (_event, ctx) => {
		if (ctx.hasUI) ctx.ui.setHeader(undefined);
	});

	pi.registerCommand('builtin-header', {
		description: 'Restore the built-in pi startup header',
		handler: async (_args, ctx) => {
			ctx.ui.setHeader(undefined);
			ctx.ui.notify('Built-in startup header restored', 'info');
		},
	});
}
