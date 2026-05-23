<script lang="ts">
	import { Accordion as AccordionPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		...rest_props
	}: ComponentProps<typeof AccordionPrimitive.Item> = $props();
</script>

<AccordionPrimitive.Item
	bind:ref
	class={cn('border-b border-border-muted', class_name)}
	{...rest_props}
>
	{@render children?.()}
</AccordionPrimitive.Item>
