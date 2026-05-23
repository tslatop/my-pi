<script lang="ts">
	let { more, total }: { more: number; total?: number } = $props();
</script>

<div class="collapse">
	… ({more} more lines{#if total != null}, {total} total{/if},
	<span class="kbd">ctrl+o</span> to expand)
</div>
