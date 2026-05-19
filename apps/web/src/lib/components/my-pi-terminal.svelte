<script lang="ts">
	type Hunk = {
		before?: string[];
		after?: string[];
		line_number?: number;
	};

	export type Turn =
		| { role: 'user'; text: string; delay?: number }
		| { role: 'assistant'; text: string; delay?: number }
		| {
				role: 'working';
				text?: string;
				duration?: number;
				delay?: number;
		  }
		| {
				role: 'read';
				path: string;
				range?: string;
				code: string;
				language?: string;
				lines_above?: number;
				lines_below?: number;
				total_lines?: number;
				delay?: number;
		  }
		| {
				role: 'write';
				path: string;
				code: string;
				language?: string;
				lines_above?: number;
				lines_below?: number;
				total_lines?: number;
				delay?: number;
		  }
		| {
				role: 'bash';
				command: string;
				output?: string;
				exit_code?: number;
				delay?: number;
		  }
		| { role: 'diff'; path: string; hunks: Hunk[]; delay?: number };

	type RenderedTurn = Turn & { id: string };

	type Metrics = {
		up: number;
		down: number;
		ram: number;
		cost: number;
		ctx_used: number;
		ctx_max: number;
	};

	let {
		cwd = '~/repos/my-pi',
		branch = 'main',
		model = 'gpt-5.4',
		provider = 'openai-codex',
		effort = 'high',
		prompt_mode = 'terse',
		conversation = [],
		typing_speed = 14,
		autoplay = true,
		loop = false,
		on_complete,
		initial_metrics = {
			up: 364_000,
			down: 26_000,
			ram: 4_100_000,
			cost: 2.335,
			ctx_used: 201_280,
			ctx_max: 272_000,
		},
	}: {
		cwd?: string;
		branch?: string;
		model?: string;
		provider?: string;
		effort?: string;
		prompt_mode?: string;
		conversation?: Turn[];
		typing_speed?: number;
		autoplay?: boolean;
		loop?: boolean;
		on_complete?: () => void;
		initial_metrics?: Metrics;
	} = $props();

	// svelte-ignore state_referenced_locally
	const start_metrics = initial_metrics;

	let rendered = $state<RenderedTurn[]>([]);
	let active = $state<{ turn: Turn; visible: string } | null>(null);
	let working = $state<{ text: string } | null>(null);
	let input_text = $state('');
	let metrics = $state<Metrics>({ ...start_metrics });
	let done = $state(false);
	let cancelled = false;
	let run_id = 0;

	const sleep = (ms: number) =>
		new Promise<void>((r) => setTimeout(r, ms));

	function bump(turn: Turn) {
		const m = { ...metrics };
		if (turn.role === 'user') {
			m.up += 400 + Math.floor(Math.random() * 800);
			m.ctx_used += 60 + Math.floor(Math.random() * 200);
		} else if (turn.role === 'assistant') {
			m.down += 2_000 + Math.floor(Math.random() * 4_000);
			m.cost += 0.008 + Math.random() * 0.012;
			m.ctx_used += 800 + Math.floor(Math.random() * 1_500);
		} else if (turn.role === 'read' || turn.role === 'write') {
			m.down += 1_500 + Math.floor(Math.random() * 3_000);
			m.cost += 0.004 + Math.random() * 0.008;
			m.ctx_used += 1_200 + Math.floor(Math.random() * 2_000);
		} else if (turn.role === 'bash') {
			m.up += 200;
			m.down += 600;
			m.cost += 0.002;
			m.ctx_used += 400;
		} else if (turn.role === 'diff') {
			m.down += 800;
			m.cost += 0.003;
			m.ctx_used += 600;
		}
		if (m.ctx_used > m.ctx_max) m.ctx_used = m.ctx_max;
		metrics = m;
	}

	function reset() {
		cancelled = true;
		rendered = [];
		active = null;
		working = null;
		input_text = '';
		metrics = { ...start_metrics };
		done = false;
	}

	async function play() {
		const my_run = ++run_id;
		cancelled = false;
		rendered = [];
		active = null;
		working = null;
		input_text = '';
		metrics = { ...start_metrics };
		done = false;

		for (let i = 0; i < conversation.length; i++) {
			if (cancelled || my_run !== run_id) return;
			const turn = conversation[i];
			await sleep(turn.delay ?? 350);
			if (cancelled || my_run !== run_id) return;

			if (turn.role === 'user') {
				for (let ch = 0; ch <= turn.text.length; ch++) {
					if (cancelled || my_run !== run_id) return;
					input_text = turn.text.slice(0, ch);
					await sleep(typing_speed);
				}
				await sleep(250);
				input_text = '';
				rendered = [...rendered, { ...turn, id: `t-${i}` }];
				bump(turn);
			} else if (turn.role === 'assistant') {
				active = { turn, visible: '' };
				for (let ch = 0; ch <= turn.text.length; ch++) {
					if (cancelled || my_run !== run_id) return;
					active = { turn, visible: turn.text.slice(0, ch) };
					await sleep(Math.max(3, typing_speed * 0.5));
				}
				active = null;
				rendered = [...rendered, { ...turn, id: `t-${i}` }];
				bump(turn);
			} else if (turn.role === 'working') {
				working = { text: turn.text ?? 'Working...' };
				await sleep(turn.duration ?? 900);
				if (cancelled || my_run !== run_id) return;
				working = null;
			} else {
				rendered = [...rendered, { ...turn, id: `t-${i}` }];
				bump(turn);
			}
		}

		done = true;
		on_complete?.();

		if (loop && !cancelled && my_run === run_id) {
			await sleep(2000);
			if (!cancelled && my_run === run_id) play();
		}
	}

	function slide_lifecycle(el: HTMLDivElement) {
		const section = el.closest('section');

		if (!section) {
			if (autoplay) play();
			return () => {
				cancelled = true;
			};
		}

		const on_in = () => {
			if (autoplay) play();
		};
		const on_out = () => reset();

		section.addEventListener('in', on_in);
		section.addEventListener('out', on_out);

		if (autoplay && !section.classList.contains('stack')) play();

		return () => {
			section.removeEventListener('in', on_in);
			section.removeEventListener('out', on_out);
			cancelled = true;
		};
	}

	function auto_scroll(el: HTMLDivElement) {
		const observer = new MutationObserver(() => {
			el.scrollTop = el.scrollHeight;
		});
		observer.observe(el, {
			childList: true,
			subtree: true,
			characterData: true,
		});
		return () => observer.disconnect();
	}

	const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
	let spinner_frame = $state(0);
	function spin() {
		const id = setInterval(() => {
			spinner_frame = (spinner_frame + 1) % spinner.length;
		}, 80);
		return () => clearInterval(id);
	}

	const keywords = new Set([
		'import',
		'from',
		'export',
		'const',
		'let',
		'var',
		'function',
		'return',
		'if',
		'else',
		'for',
		'while',
		'do',
		'switch',
		'case',
		'break',
		'continue',
		'class',
		'extends',
		'new',
		'this',
		'super',
		'async',
		'await',
		'try',
		'catch',
		'finally',
		'throw',
		'typeof',
		'instanceof',
		'in',
		'of',
		'void',
		'delete',
		'yield',
		'static',
		'public',
		'private',
		'protected',
		'interface',
		'implements',
		'type',
		'enum',
		'readonly',
	]);
	const constants = new Set([
		'null',
		'undefined',
		'true',
		'false',
		'NaN',
		'Infinity',
	]);

	type Tok = {
		t: 'c' | 's' | 'n' | 'k' | 'cn' | 'i' | 'o' | 'p';
		v: string;
	};
	function highlight_line(line: string): Tok[] {
		const out: Tok[] = [];
		let i = 0;
		while (i < line.length) {
			const rest = line.slice(i);

			const m_c = rest.match(/^\/\/.*/);
			if (m_c) {
				out.push({ t: 'c', v: m_c[0] });
				i += m_c[0].length;
				continue;
			}
			const m_s = rest.match(/^(['"`])(?:\\.|(?!\1).)*\1?/);
			if (m_s) {
				out.push({ t: 's', v: m_s[0] });
				i += m_s[0].length;
				continue;
			}
			const m_n = rest.match(/^(0x[0-9a-fA-F]+|\d+(?:\.\d+)?)/);
			if (m_n) {
				out.push({ t: 'n', v: m_n[0] });
				i += m_n[0].length;
				continue;
			}
			const m_i = rest.match(/^[A-Za-z_$#][A-Za-z0-9_$]*/);
			if (m_i) {
				const w = m_i[0];
				if (keywords.has(w)) out.push({ t: 'k', v: w });
				else if (constants.has(w)) out.push({ t: 'cn', v: w });
				else out.push({ t: 'i', v: w });
				i += w.length;
				continue;
			}
			const m_o = rest.match(
				/^(===|!==|==|!=|=>|<=|>=|\+\+|--|&&|\|\||[=+\-*/%<>!&|^~?:])/,
			);
			if (m_o) {
				out.push({ t: 'o', v: m_o[0] });
				i += m_o[0].length;
				continue;
			}
			out.push({ t: 'p', v: line[i] });
			i += 1;
		}
		return out;
	}

	function format_k(n: number) {
		if (n >= 1_000_000) {
			const v = n / 1_000_000;
			return `${v.toFixed(v < 10 ? 1 : 0)}M`;
		}
		if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
		return `${n}`;
	}
</script>

{#snippet caret()}
	<span class="caret"></span>
{/snippet}

{#snippet code_block(code: string)}
	<div class="code">
		{#each code.split('\n') as line, idx (idx)}
			{@const toks = highlight_line(line)}
			<!-- prettier-ignore -->
			<div class="code-line">{#if toks.length === 0}&nbsp;{:else}{#each toks as tok, ti (ti)}<span class="tok tok-{tok.t}">{tok.v}</span>{/each}{/if}</div>
		{/each}
	</div>
{/snippet}

{#snippet collapse_hint(more: number, total?: number)}
	<div class="collapse">
		… ({more} more lines{#if total != null}, {total} total{/if},
		<span class="kbd">ctrl+o</span> to expand)
	</div>
{/snippet}

<div class="term-wrap">
	<div class="terminal" {@attach slide_lifecycle}>
		<div class="scroll" {@attach auto_scroll}>
			{#each rendered as t (t.id)}
				{#if t.role === 'user'}
					<div class="user-turn">
						<span class="user-chev">›</span>
						<span class="user-text">{t.text}</span>
					</div>
				{:else if t.role === 'assistant'}
					<div class="assistant-turn">{t.text}</div>
				{:else if t.role === 'read' || t.role === 'write'}
					<div class="file-turn">
						<div class="file-head">
							<span class="file-verb">{t.role}</span>
							<span class="file-path">{t.path}</span
							>{#if t.role === 'read' && t.range}<span
									class="file-colon">:</span
								><span class="file-range">{t.range}</span>{/if}
						</div>
						{#if t.lines_above != null && t.lines_above > 0}
							<div class="collapse-wrap">
								{@render collapse_hint(t.lines_above)}
							</div>
						{/if}
						{@render code_block(t.code)}
						{#if t.lines_below != null && t.lines_below > 0}
							<div class="collapse-wrap">
								{@render collapse_hint(t.lines_below, t.total_lines)}
							</div>
						{/if}
					</div>
				{:else if t.role === 'bash'}
					<div class="bash-turn">
						<div class="bash-head">
							<span class="file-verb">bash</span>
							<span class="bash-dollar">$</span>
							<span class="bash-cmd">{t.command}</span>
						</div>
						{#if t.output}
							<pre class="bash-output">{t.output}</pre>
						{/if}
						{#if (t.exit_code ?? 0) !== 0}
							<div class="bash-exit">exit {t.exit_code}</div>
						{/if}
					</div>
				{:else if t.role === 'diff'}
					<div class="diff-turn">
						<div class="file-head">
							<span class="file-verb">edit</span>
							<span class="file-path">{t.path}</span>
						</div>
						<div class="diff-body">
							{#each t.hunks as hunk, hi (hi)}
								<div
									class="hunk"
									class:last={hi === t.hunks.length - 1}
								>
									{#if hunk.line_number != null}
										<div class="hunk-head">
											@@ line {hunk.line_number} @@
										</div>
									{/if}
									{#each hunk.before ?? [] as ln, li (`b-${li}`)}
										<div class="diff-line removed">
											<span class="sign">-</span><span
												>{ln || '\u00a0'}</span
											>
										</div>
									{/each}
									{#each hunk.after ?? [] as ln, li (`a-${li}`)}
										<div class="diff-line added">
											<span class="sign">+</span><span
												>{ln || '\u00a0'}</span
											>
										</div>
									{/each}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{/each}

			{#if active && active.turn.role === 'assistant'}
				<div class="assistant-turn">
					{active.visible}{@render caret()}
				</div>
			{/if}

			{#if working}
				<div class="working">
					<span class="spinner" {@attach spin}
						>{spinner[spinner_frame]}</span
					>
					<span>{working.text}</span>
				</div>
			{/if}
		</div>

		<div class="input-box">
			<span class="input-text"
				>{input_text}{#if !done}{@render caret()}{/if}</span
			>
		</div>

		<div class="status-bar">
			<div class="status-left">
				<div>
					{cwd} <span class="muted">({branch})</span>
				</div>
				<div class="metrics">
					<span class="muted">↑</span>{format_k(metrics.up)}
					<span class="muted">↓</span>{format_k(metrics.down)}
					<span class="muted">R</span>{format_k(metrics.ram)}
					<span class="muted">${metrics.cost.toFixed(3)}</span>
					<span class="muted">(sub)</span>
					<span class="yellow-hi"
						>{((metrics.ctx_used / metrics.ctx_max) * 100).toFixed(
							1,
						)}%/{format_k(metrics.ctx_max)}</span
					>
				</div>
			</div>
			<div class="status-right">
				<div>
					<span class="muted">({provider})</span>
					{model} <span class="sep">·</span>
					<span class="fg">{effort}</span>
				</div>
				<div class="muted prompt-mode">prompt:{prompt_mode}</div>
			</div>
		</div>
	</div>
</div>

<style>
	.term-wrap {
		position: relative;
		min-height: clamp(34rem, 58vw, 44rem);
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: left;
	}

	.terminal {
		--no-bg: #010e1a;
		--no-border: #0d2a43;
		--no-fg: #d6deeb;
		--no-muted: #637777;
		--no-dim: #5f7e97;
		--no-yellow: #ecc48d;
		--no-yellow-hi: #ffeb95;
		--no-green: #addb67;
		--no-green-bg: #0f2a16;
		--no-purple: #c792ea;
		--no-cyan: #82aaff;
		--no-teal: #7fdbca;
		--no-orange: #f78c6c;
		--no-red: #ef5350;
		--no-red-bg: #2a0f12;
		--no-string: var(--no-yellow);
		--no-number: var(--no-orange);
		--no-constant: var(--no-orange);

		background: var(--no-bg);
		border: 1px solid var(--no-border);
		color: var(--no-fg);
		font-family:
			'Victor Mono Variable', 'Victor Mono',
			'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code',
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: clamp(0.78rem, 1.45vw, 1rem);
		line-height: 1.55;
		padding: 1.25rem 1.5rem;
		border-radius: 12px;
		width: 100%;
		max-width: 1680px;
		height: 100%;
		max-height: none;
		display: flex;
		flex-direction: column;
		box-shadow:
			0 20px 40px rgba(0, 0, 0, 0.32),
			0 2px 8px rgba(0, 0, 0, 0.22);
		font-variant-ligatures: contextual;
		text-align: left;
	}

	:global([data-theme='light']) .terminal {
		--no-bg: #f6f6f6;
		--no-border: #d9d9d9;
		--no-fg: #403f53;
		--no-muted: #989fb1;
		--no-dim: #5f7e97;
		--no-yellow: #e0af02;
		--no-yellow-hi: #aa0982;
		--no-green: #08916a;
		--no-green-bg: rgba(8, 145, 106, 0.12);
		--no-purple: #994cc3;
		--no-cyan: #4876d6;
		--no-teal: #0c969b;
		--no-orange: #c96765;
		--no-red: #d3423e;
		--no-red-bg: rgba(211, 66, 62, 0.12);
		--no-string: var(--no-cyan);
		--no-number: var(--no-yellow-hi);
		--no-constant: #bc5454;

		box-shadow:
			0 20px 40px rgba(64, 63, 83, 0.08),
			0 2px 8px rgba(64, 63, 83, 0.05);
	}

	.scroll {
		flex: 1;
		overflow-y: auto;
		padding-right: 4px;
	}

	.user-turn {
		margin: 1rem 0 0.5rem;
		display: flex;
		gap: 10px;
		align-items: flex-start;
	}
	.user-chev {
		color: var(--no-cyan);
		flex-shrink: 0;
	}
	.user-text {
		color: var(--no-fg);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		word-break: break-word;
		flex: 1 1 0;
		min-width: 0;
	}

	.assistant-turn {
		margin: 0.75rem 0;
		color: var(--no-fg);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		word-break: break-word;
		line-height: 1.6;
	}

	.file-turn,
	.bash-turn,
	.diff-turn {
		margin: 1rem 0;
	}

	.file-head,
	.bash-head {
		margin-bottom: 0.4rem;
		font-size: 19px;
	}
	.file-verb {
		color: var(--no-fg);
		font-weight: 700;
	}
	.file-path {
		color: var(--no-fg);
		margin-left: 8px;
	}
	.file-colon {
		color: var(--no-fg);
	}
	.file-range {
		color: var(--no-yellow-hi);
	}

	.code {
		padding: 0.4rem 0 0.4rem 1.25rem;
		color: var(--no-fg);
		font-size: 19px;
		line-height: 1.55;
	}
	.code-line {
		white-space: pre;
	}
	.tok-c {
		color: var(--no-muted);
	}
	.tok-s {
		color: var(--no-string);
	}
	.tok-n {
		color: var(--no-number);
	}
	.tok-k {
		color: var(--no-purple);
	}
	.tok-cn {
		color: var(--no-constant);
	}
	.tok-i {
		color: var(--no-fg);
	}
	.tok-o {
		color: var(--no-teal);
	}
	.tok-p {
		color: var(--no-fg);
	}

	.collapse-wrap {
		padding-left: 1.25rem;
		margin: 2px 0;
	}
	.collapse {
		color: var(--no-dim);
		font-size: 17px;
	}
	.kbd {
		color: var(--no-muted);
	}

	.bash-dollar {
		color: var(--no-green);
		margin: 0 8px;
	}
	.bash-cmd {
		color: var(--no-fg);
	}
	.bash-output {
		margin: 0;
		padding: 0.25rem 0 0.25rem 1.25rem;
		color: var(--no-dim);
		font-size: 19px;
		line-height: 1.55;
		white-space: pre-wrap;
		font-family: inherit;
	}
	.bash-exit {
		padding-left: 1.25rem;
		color: var(--no-red);
		font-size: 16px;
		margin-top: 2px;
	}

	.diff-body {
		font-size: 19px;
		line-height: 1.55;
		padding-left: 1.25rem;
	}
	.hunk {
		margin-bottom: 8px;
	}
	.hunk.last {
		margin-bottom: 0;
	}
	.hunk-head {
		color: var(--no-muted);
		margin-bottom: 2px;
	}
	.diff-line {
		padding-left: 6px;
		white-space: pre-wrap;
	}
	.diff-line.removed {
		background: var(--no-red-bg);
	}
	.diff-line.added {
		background: var(--no-green-bg);
	}
	.diff-line.removed .sign {
		color: var(--no-red);
		margin-right: 8px;
	}
	.diff-line.added .sign {
		color: var(--no-green);
		margin-right: 8px;
	}

	.working {
		margin: 0.75rem 0;
		color: var(--no-dim);
		font-size: 19px;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.spinner {
		color: var(--no-dim);
	}

	.caret {
		display: inline-block;
		width: 0.55em;
		height: 1.1em;
		background: var(--no-fg);
		vertical-align: text-bottom;
		margin-left: 1px;
		animation: mpi-blink 1s steps(1) infinite;
	}
	@keyframes mpi-blink {
		50% {
			opacity: 0;
		}
	}

	.input-box {
		margin-top: 0.75rem;
		border-top: 1px solid var(--no-border);
		border-bottom: 1px solid var(--no-border);
		padding: 0.5rem 0.25rem;
		display: flex;
		align-items: center;
		min-height: calc(1.55em + 1rem + 2px);
		box-sizing: border-box;
	}
	.input-text {
		color: var(--no-fg);
		flex: 1 1 0;
		min-width: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		word-break: break-word;
	}

	.status-bar {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-top: 0.5rem;
		font-size: 22px;
		color: var(--no-dim);
	}
	.status-right {
		text-align: right;
	}
	.metrics {
		margin-top: 2px;
	}
	.muted {
		color: var(--no-muted);
	}
	.yellow-hi {
		color: var(--no-yellow-hi);
	}
	.sep {
		color: var(--no-border);
	}
	.fg {
		color: var(--no-fg);
	}
	.prompt-mode {
		margin-top: 2px;
	}
</style>
