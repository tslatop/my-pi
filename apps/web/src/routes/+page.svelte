<script lang="ts">
	const logo_lines = [
		'███╗   ███╗                  ██████╗ ██╗',
		'████╗ ████║ ██╗   ██╗        ██╔══██╗   ',
		'██╔████╔██║ ╚██╗ ██╔╝ ████╗  ██████╔╝██╗',
		'██║╚██╔╝██║  ╚████╔╝ ╚═══╝   ██╔═══╝ ██║',
		'██║ ╚═╝ ██║   ╚██╔╝          ██║     ██║',
		'╚═╝     ╚═╝   ██╔╝           ╚═╝     ╚═╝',
	] as const;
</script>

<svelte:head>
	<title>My-Pi</title>
	<meta
		name="description"
		content="A vivid terminal-first coding agent interface."
	/>
</svelte:head>

<main
	class="min-h-screen overflow-hidden bg-background px-5 py-10 text-foreground sm:px-8 lg:px-12"
>
	<section
		class="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]"
	>
		<div class="max-w-xl">
			<p
				class="mb-5 font-mono text-sm tracking-[0.32em] text-accent uppercase"
			>
				Afterglow terminal UI
			</p>
			<h1
				class="font-serif text-5xl leading-[0.95] font-semibold text-balance sm:text-7xl"
			>
				My-Pi, tuned for the neon dark.
			</h1>
			<p class="mt-6 text-xl leading-8 text-muted">
				A web face for the startup screen: hot magenta, acid green,
				cyan edges, and a monospaced preview pulled from the same visual
				language as the CLI.
			</p>
			<div class="mt-8 flex flex-wrap gap-3 font-mono text-sm">
				<a
					class="rounded-full border border-accent bg-[color-mix(in_srgb,var(--afterglow-text-accent)_18%,transparent)] px-5 py-3 text-accent shadow-(--afterglow-shadow-magenta) transition hover:bg-element-hover"
					href="/demo"
				>
					View demo
				</a>
				<a
					class="rounded-full border border-border-muted px-5 py-3 text-muted transition hover:border-cyan hover:text-cyan"
					href="https://github.com/earendil-works/pi-coding-agent"
				>
					GitHub
				</a>
			</div>
		</div>

		<div
			class="relative rounded-4xl border border-border-muted bg-[color-mix(in_srgb,var(--afterglow-surface-background)_88%,black)] p-4 shadow-[0_0_80px_rgb(255_0_204/0.18)]"
		>
			<div
				class="absolute -inset-20 -z-10 bg-[radial-gradient(circle,var(--afterglow-terminal-magenta)_0%,transparent_58%)] opacity-20 blur-3xl"
			></div>
			<div
				class="rounded-[1.35rem] border border-border-muted bg-[#05010a] p-5 font-mono text-[clamp(0.55rem,1.35vw,1.05rem)] leading-none text-accent sm:p-8"
			>
				<div class="mb-4 text-center text-[1.35em] text-accent">
					My-Pi v0.1.57
				</div>
				<pre
					class="logo-gradient mx-auto w-max max-w-full overflow-hidden text-[1em] leading-[0.95] font-black tracking-[-0.08em]"
				>{logo_lines.join('\n')}</pre>
				<div
					class="mt-5 text-center text-[1.05em] text-magenta"
				>
					gpt-5.5 <span class="text-muted">· my-pi</span>
				</div>
				<div
					class="mt-8 space-y-2 border-t border-border-muted pt-4 text-[0.78em] leading-normal text-muted"
				>
					<p>~/repos/my-pi (⌘ main ✐2 ↟2)</p>
					<p class="flex justify-between gap-4">
						<span>$0.000 (sub) 0.0%/272k</span>
						<span class="text-accent">gpt-5.5 • low</span>
					</p>
					<p class="flex justify-between gap-4">
						<span>MCP 6/6 connected</span>
						<span>prompt:terse +1</span>
					</p>
				</div>
			</div>
		</div>
	</section>
</main>

<style>
	.logo-gradient {
		background: linear-gradient(
			90deg,
			var(--afterglow-terminal-green),
			var(--afterglow-terminal-yellow),
			var(--afterglow-terminal-magenta),
			var(--afterglow-terminal-blue)
		);
		background-clip: text;
		color: transparent;
		filter: drop-shadow(0 0 10px rgb(255 0 204 / 0.22));
	}
</style>
