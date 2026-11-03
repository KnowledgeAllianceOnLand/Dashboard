<script>
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';

	let { children } = $props();
	export const ssr = false;
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="h-screen w-screen">
	<div class="bg-amber-400 flex">
		<p>Whose Land, Whose Transition?</p>
		<nav class="bg-amber-200">
			<!-- <a>About</a>
			<a>Data Viewer</a> -->
		</nav>
	</div>
	{@render children()}
</div>