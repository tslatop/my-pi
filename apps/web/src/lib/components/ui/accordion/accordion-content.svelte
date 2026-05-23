<script lang="ts">
	import { Accordion as AccordionPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';
	import type { ComponentProps } from 'svelte';

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		...rest_props
	}: ComponentProps<typeof AccordionPrimitive.Content> = $props();
</script>

<AccordionPrimitive.Content
	bind:ref
	class={cn('overflow-hidden pb-5 leading-7 text-muted', class_name)}
	{...rest_props}
>
	{@render children?.()}
</AccordionPrimitive.Content>
