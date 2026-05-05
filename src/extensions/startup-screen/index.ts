import type {
	ExtensionAPI,
	ExtensionContext,
	Theme,
} from '@mariozechner/pi-coding-agent';
import { truncateToWidth, visibleWidth } from '@mariozechner/pi-tui';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

interface Rgb {
	r: number;
	g: number;
	b: number;
}

const LOGO_MASK = [
	'██   ██ ██  ██        █████  ██',
	'███ ███  ████         ██  ██   ',
	'███████   ██    ████  █████  ██',
	'██ █ ██   ██          ██     ██',
	'██   ██   ██          ██     ██',
	'██   ██   ██          ██     ██',
	'██   ██  ██           ██     ██',
] as const;

const BLUE_STOPS: Rgb[] = [
	{ r: 102, g: 169, b: 255 },
	{ r: 42, g: 132, b: 255 },
	{ r: 0, g: 92, b: 224 },
	{ r: 13, g: 61, b: 170 },
];

const RESET_FG = '\x1b[39m';

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

function lerp(a: number, b: number, t: number): number {
	return Math.round(a + (b - a) * t);
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
	return {
		r: lerp(a.r, b.r, t),
		g: lerp(a.g, b.g, t),
		b: lerp(a.b, b.b, t),
	};
}

function palette_at(t: number): Rgb {
	const clamped = Math.max(0, Math.min(1, t));
	const scaled = clamped * (BLUE_STOPS.length - 1);
	const index = Math.min(Math.floor(scaled), BLUE_STOPS.length - 2);
	return mix(
		BLUE_STOPS[index],
		BLUE_STOPS[index + 1],
		scaled - index,
	);
}

function shade(color: Rgb, amount: number): Rgb {
	return {
		r: Math.max(0, Math.min(255, Math.round(color.r * amount))),
		g: Math.max(0, Math.min(255, Math.round(color.g * amount))),
		b: Math.max(0, Math.min(255, Math.round(color.b * amount))),
	};
}

function ansi_rgb(color: Rgb, text: string): string {
	return `\x1b[38;2;${color.r};${color.g};${color.b}m${text}${RESET_FG}`;
}

function logo_color(x: number, y: number, width: number): Rgb {
	const base = palette_at((x + y * 0.22) / Math.max(1, width - 1));
	const band = x % 4 === 0 ? 1.12 : x % 4 === 3 ? 0.86 : 1;
	return shade(base, band);
}

const LOGO_WIDTH = Math.max(...LOGO_MASK.map((line) => line.length));
const LOGO_HEIGHT = LOGO_MASK.length;

function is_logo_cell(x: number, y: number): boolean {
	return LOGO_MASK[y]?.[x] !== undefined && LOGO_MASK[y][x] !== ' ';
}

function is_shifted_logo_cell(x: number, y: number): boolean {
	return is_logo_cell(x - 1, y - 1);
}

function is_outline_cell(x: number, y: number): boolean {
	if (is_logo_cell(x, y) || !is_shifted_logo_cell(x, y)) return false;
	return (
		!is_shifted_logo_cell(x - 1, y) ||
		!is_shifted_logo_cell(x + 1, y) ||
		!is_shifted_logo_cell(x, y - 1) ||
		!is_shifted_logo_cell(x, y + 1)
	);
}

function outline_char(x: number, y: number): string {
	const up = is_outline_cell(x, y - 1);
	const down = is_outline_cell(x, y + 1);
	const left = is_outline_cell(x - 1, y);
	const right = is_outline_cell(x + 1, y);

	if ((left || right) && !(up || down)) return '─';
	if ((up || down) && !(left || right)) return '│';
	if (right && down) return '┌';
	if (left && down) return '┐';
	if (right && up) return '└';
	if (left && up) return '┘';
	return '┼';
}

function render_logo_line(theme: Theme, y: number): string {
	let line = '';
	for (let x = 0; x < LOGO_WIDTH + 1; x++) {
		if (is_logo_cell(x, y)) {
			line +=
				theme.getColorMode() === 'truecolor'
					? ansi_rgb(logo_color(x, y, LOGO_WIDTH), '█')
					: theme.fg('accent', '█');
		} else if (is_outline_cell(x, y)) {
			line +=
				theme.getColorMode() === 'truecolor'
					? ansi_rgb({ r: 15, g: 75, b: 170 }, outline_char(x, y))
					: theme.fg('borderAccent', outline_char(x, y));
		} else {
			line += ' ';
		}
	}
	return line.trimEnd();
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

function render_subtitle(
	ctx: ExtensionContext,
	theme: Theme,
): string {
	const model = ctx.model?.id ?? 'no model';
	const project = basename(ctx.cwd) || ctx.cwd;
	return `${theme.fg('text', model)} ${theme.fg('muted', '·')} ${theme.fg('accent', project)}`;
}

export function render_startup_header(
	ctx: ExtensionContext,
	theme: Theme,
	width: number,
): string[] {
	if (width < 24) {
		return [
			center_line(theme.bold(theme.fg('accent', 'My-Pi')), width),
			center_line(render_subtitle(ctx, theme), width),
		];
	}

	const logo = Array.from({ length: LOGO_HEIGHT + 1 }, (_line, y) =>
		center_line(render_logo_line(theme, y), width),
	);
	const subtitle = center_line(render_subtitle(ctx, theme), width);
	const help = center_line(
		theme.fg(
			'dim',
			`my-pi v${MY_PI_VERSION} · / commands · ! bash · tab for more`,
		),
		width,
	);

	return ['', ...logo, '', subtitle, help];
}

export default function startup_screen_extension(
	pi: ExtensionAPI,
): void {
	pi.on('session_start', async (_event, ctx) => {
		if (!ctx.hasUI) return;

		ctx.ui.setHeader((_tui, theme) => ({
			invalidate() {},
			render(width: number) {
				return render_startup_header(ctx, theme, width);
			},
		}));
	});

	pi.registerCommand('builtin-header', {
		description: 'Restore the built-in pi startup header',
		handler: async (_args, ctx) => {
			ctx.ui.setHeader(undefined);
			ctx.ui.notify('Built-in startup header restored', 'info');
		},
	});
}
