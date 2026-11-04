<script>
	export const ssr = false;

	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';

	import Nav from '#lib/components/Nav.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="h-screen w-screen grid grid-rows-[2.8rem_calc(100vh-2.8rem)]">
	<div class="bg-amber-400 flex">
		<a href="/">Whose Land, Whose Transition?</a>
		
	</div>
	<div class="bg-red-200 overflow-y-auto">
		{@render children()}
	</div>
</div>