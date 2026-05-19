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
		class="mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl items-center justify-center"
	>
		<div class="relative">
			<div
				class="absolute -inset-20 -z-10 bg-[radial-gradient(circle,var(--afterglow-terminal-magenta)_0%,transparent_58%)] opacity-20 blur-3xl"
			></div>
			<div
				class="rounded-4xl bg-[color-mix(in_srgb,var(--afterglow-surface-background)_88%,black)] p-4 shadow-[0_0_80px_rgb(255_0_204/0.18)]"
			>
				<div
					class="rounded-[1.35rem] bg-[#05010a] p-5 font-mono text-[clamp(0.55rem,1.35vw,1.05rem)] leading-none text-accent sm:p-8"
				>
					<pre
						class="logo-gradient mx-auto w-max max-w-full overflow-hidden text-[1em] leading-[0.95] font-black tracking-[-0.08em]"
					>{logo_lines.join('\n')}</pre>
				</div>
			</div>
			<a
				class="mt-7 block text-center font-mono text-sm text-muted transition hover:text-accent"
				href="https://github.com/spences10/my-pi"
			>
				github.com/spences10/my-pi
			</a>
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
