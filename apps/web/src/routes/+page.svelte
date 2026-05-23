<script lang="ts">
	import * as Accordion from "$lib/components/ui/accordion/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import * as Card from "$lib/components/ui/card/index.js";
	import { Head, SchemaOrg } from "svead";
	import {
		compose_lines,
		detail_lines,
		faq_lines,
		logo_lines,
		package_lines,
		page_schema,
		safety_lines,
		seo_config,
	} from "./page-content.js";
</script>

<Head {seo_config} />
<SchemaOrg schema={page_schema} />

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
				class="rounded-4xl bg-[color-mix(in_srgb,var(--afterglow-surface-background)_88%,black)] shadow-[0_0_80px_rgb(255_0_204/0.18)]"
			>
				<div
					class="rounded-[1.35rem] bg-[#05010a] p-5 font-mono text-[clamp(0.55rem,1.35vw,1.05rem)] leading-none text-accent sm:p-8"
				>
					<pre
						class="logo-gradient mx-auto w-max max-w-full overflow-hidden text-[1em] leading-[0.95] font-black tracking-[-0.08em]">{logo_lines.join(
							"\n",
						)}</pre>
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

	<section class="mx-auto max-w-7xl pt-6 pb-24 sm:pb-32 lg:pt-16">
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each detail_lines as [detail_title, detail_body] (detail_title)}
				<Card.Root
					class="group border border-border-muted bg-surface/70 p-6 transition hover:border-accent hover:bg-element-hover/45"
				>
					<Card.Header class="px-0">
						<Card.Title class="font-mono text-lg font-bold text-foreground">
							{detail_title}
						</Card.Title>
					</Card.Header>
					<Card.Content class="px-0">
						<p class="leading-7 text-muted group-hover:text-foreground/85">
							{detail_body}
						</p>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>

		<section class="mx-auto mt-20 max-w-6xl" aria-labelledby="compose-heading">
			<div class="mx-auto max-w-3xl text-center">
				<Badge
					variant="outline"
					class="border-cyan/60 bg-cyan/10 font-mono tracking-[0.24em] text-cyan uppercase"
				>
					Composable by design
				</Badge>
				<h2
					id="compose-heading"
					class="mt-5 text-3xl leading-none font-black tracking-tighter text-foreground sm:text-5xl"
				>
					Use the full stack, then snap in the agent pieces you need.
				</h2>
				<p class="mt-5 text-base leading-8 text-muted sm:text-lg">
					my-pi works like a small agent system: start with the distro, compose
					focused packages, then bind it to each workspace.
				</p>
			</div>

			<div class="mt-10 grid gap-4 lg:grid-cols-3">
				{#each compose_lines as [compose_title, compose_body, compose_command], index (compose_title)}
					<Card.Root
						class="relative border border-border-muted bg-surface/70 p-6 transition focus-within:border-cyan hover:border-accent hover:bg-element-hover/45"
					>
						<Card.Header class="gap-4 px-0">
							<div
								class="flex size-9 items-center justify-center border border-border-muted bg-background font-mono text-sm text-cyan"
							>
								0{index + 1}
							</div>
							<Card.Title class="font-mono text-lg font-bold text-foreground">
								{compose_title}
							</Card.Title>
						</Card.Header>
						<Card.Content class="space-y-5 px-0">
							<p class="min-h-14 leading-7 text-muted">
								{compose_body}
							</p>
							<code
								class="block overflow-x-auto border border-border-muted bg-background/80 px-3 py-2 font-mono text-sm text-cyan"
							>
								{compose_command}
							</code>
						</Card.Content>
					</Card.Root>
				{/each}
			</div>

			<Card.Root
				class="mt-4 border border-border-muted bg-[color-mix(in_srgb,var(--afterglow-surface-background)_82%,black)] p-6 sm:p-8"
				aria-labelledby="package-grid-heading"
			>
				<Card.Header class="px-0">
					<div
						class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
					>
						<div>
							<Badge
								variant="outline"
								class="border-magenta/60 bg-magenta/10 font-mono tracking-[0.24em] text-magenta uppercase"
							>
								Package modules
							</Badge>
							<Card.Title
								id="package-grid-heading"
								class="mt-4 text-2xl leading-none font-black tracking-tighter text-foreground sm:text-4xl"
							>
								One distribution, many agent building blocks.
							</Card.Title>
						</div>
						<a
							class="font-mono text-sm text-muted underline decoration-border-muted underline-offset-4 transition hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan"
							href="https://github.com/spences10/my-pi#reusable-pi-packages"
						>
							View all packages
						</a>
					</div>
				</Card.Header>
				<Card.Content class="px-0">
					<div class="flex flex-wrap gap-3">
						{#each package_lines as package_name (package_name)}
							<Badge
								variant="outline"
								class="h-auto border-border-muted bg-element/70 px-3 py-2 font-mono text-sm text-foreground"
							>
								<span class="text-muted">@spences10/pi-</span>{package_name}
							</Badge>
						{/each}
					</div>
				</Card.Content>
			</Card.Root>
		</section>

		<section class="mx-auto mt-20 max-w-6xl">
			<div class="mx-auto max-w-3xl text-center">
				<Badge
					variant="outline"
					class="border-green/60 bg-green/10 font-mono tracking-[0.24em] text-green uppercase"
				>
					Safety built in
				</Badge>
				<h2
					class="mt-5 text-3xl leading-none font-black tracking-tighter text-foreground sm:text-5xl"
				>
					Powerful agent workflows should still feel controlled.
				</h2>
			</div>

			<div class="mt-10 grid gap-4 md:grid-cols-3">
				{#each safety_lines as [safety_title, safety_body] (safety_title)}
					<Card.Root
						class="border border-border-muted bg-surface/70 p-6 transition hover:border-green/70 hover:bg-element-hover/35"
					>
						<Card.Header class="px-0">
							<Card.Title class="font-mono text-lg font-bold text-foreground">
								{safety_title}
							</Card.Title>
						</Card.Header>
						<Card.Content class="px-0">
							<p class="leading-7 text-muted">{safety_body}</p>
						</Card.Content>
					</Card.Root>
				{/each}
			</div>
		</section>

		<section class="mx-auto mt-20 max-w-4xl">
			<div class="mx-auto max-w-3xl text-center">
				<Badge
					variant="outline"
					class="border-cyan/60 bg-cyan/10 font-mono tracking-[0.24em] text-cyan uppercase"
				>
					FAQ
				</Badge>
				<h2
					class="mt-5 text-3xl leading-none font-black tracking-tighter text-foreground sm:text-5xl"
				>
					Questions people search before trying a coding-agent CLI.
				</h2>
			</div>

			<Card.Root
				class="mt-10 border border-border-muted bg-[color-mix(in_srgb,var(--afterglow-surface-background)_70%,white_6%)] p-6 sm:p-8"
			>
				<Card.Content class="px-0">
					<Accordion.Root type="single" value="faq-0">
						{#each faq_lines as [question, answer], index (question)}
							<Accordion.Item value={`faq-${index}`}>
								<Accordion.Trigger class="text-foreground hover:text-cyan">
									{question}
								</Accordion.Trigger>
								<Accordion.Content
									class="max-w-3xl text-base leading-8 text-foreground/90"
								>
									{answer}
								</Accordion.Content>
							</Accordion.Item>
						{/each}
					</Accordion.Root>
				</Card.Content>
			</Card.Root>
		</section>
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
