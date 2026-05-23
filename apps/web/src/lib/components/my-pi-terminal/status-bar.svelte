<script lang="ts">
	import { format_k } from "./syntax";
	import type { Metrics } from "./types";

	let {
		cwd,
		branch,
		provider,
		model,
		effort,
		prompt_mode,
		metrics,
	}: {
		cwd: string;
		branch: string;
		provider: string;
		model: string;
		effort: string;
		prompt_mode: string;
		metrics: Metrics;
	} = $props();
</script>

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
				>{((metrics.ctx_used / metrics.ctx_max) * 100).toFixed(1)}%/{format_k(
					metrics.ctx_max,
				)}</span
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
