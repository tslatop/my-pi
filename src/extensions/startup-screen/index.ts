import type {
	ExtensionAPI,
	ExtensionContext,
	Theme,
} from '@mariozechner/pi-coding-agent';
import { truncateToWidth, visibleWidth } from '@mariozechner/pi-tui';
import { basename } from 'node:path';

type Rgb = [number, number, number];

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

const DEEP_BLUE: Rgb = [22, 83, 189];
const BLUE: Rgb = [48, 129, 247];
const SKY: Rgb = [93, 171, 255];
const ICE: Rgb = [151, 205, 255];
const PALETTE: Rgb[] = [DEEP_BLUE, BLUE, SKY, ICE, SKY, BLUE];

const TITLE_LINES = [
	'  ██████╗  ██╗ ',
	'  ██╔══██╗ ██║ ',
	'  ██████╔╝ ██║ ',
	'  ██╔═══╝  ██║ ',
	'  ██║      ██║ ',
	'  ╚═╝      ╚═╝ ',
] as const;

function mix(a: number, b: number, t: number): number {
	return Math.round(a + (b - a) * t);
}

function sample_gradient(position: number): Rgb {
	const wrapped = ((position % 1) + 1) % 1;
	const scaled = wrapped * PALETTE.length;
	const index = Math.floor(scaled);
	const next_index = (index + 1) % PALETTE.length;
	const t = scaled - index;
	const a = PALETTE[index]!;
	const b = PALETTE[next_index]!;
	return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
}

function ansi_fg([r, g, b]: Rgb, text: string): string {
	return `\x1b[38;2;${r};${g};${b}m${text}${RESET}`;
}

function gradient_text(text: string, phase: number): string {
	const chars = text.split('');
	const span = Math.max(chars.length - 1, 1);
	return chars
		.map((char, index) => {
			if (char === ' ') return char;
			return ansi_fg(sample_gradient(index / span + phase), char);
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
	line: string,
	phase: number,
): string {
	return theme.getColorMode() === 'truecolor'
		? gradient_text(line, phase)
		: theme.fg('accent', line);
}

function render_subtitle(
	ctx: ExtensionContext,
	theme: Theme,
	model_id: string,
	width: number,
): string {
	const project = basename(ctx.cwd) || ctx.cwd;
	const subtitle = center_line(`${model_id} · ${project}`, width);
	return theme.getColorMode() === 'truecolor'
		? `${BOLD}${gradient_text(subtitle, 0.18)}${RESET}`
		: theme.bold(theme.fg('accent', subtitle));
}

export function render_startup_header(
	ctx: ExtensionContext,
	theme: Theme,
	width: number,
	model_id = ctx.model?.id ?? 'no model selected',
): string[] {
	if (width < 24) {
		return [
			center_line(theme.bold(theme.fg('accent', 'pi')), width),
			center_line(
				`${model_id} · ${basename(ctx.cwd) || ctx.cwd}`,
				width,
			),
		];
	}

	const logo = TITLE_LINES.map((line, row) =>
		color_line(theme, center_line(line, width), row * 0.045),
	);

	return [
		'',
		...logo,
		render_subtitle(ctx, theme, model_id, width),
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
