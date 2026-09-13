<script lang="ts">
	import type { NavItem } from '$lib';

	let open = $state(false);

	type Props = {
		list: Array<NavItem>;
		changeSpineIndex: (index: number) => void;
	};

	let { list, changeSpineIndex }: Props = $props();

	const ITEM_HEIGHT = 40;
	const OVERSCAN = 5;

	let scrollTop = $state(0);
	let containerHeight = $state(0);
	let container: HTMLElement | null = null;

	const visibleStart = $derived(Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN));
	const visibleEnd = $derived(
		Math.min(list.length, Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + OVERSCAN)
	);
	const visibleItems = $derived(list.slice(visibleStart, visibleEnd));
	const totalHeight = $derived(list.length * ITEM_HEIGHT);
	const offsetY = $derived(visibleStart * ITEM_HEIGHT);

	function onScroll(e: Event) {
		scrollTop = (e.target as HTMLElement).scrollTop;
	}
</script>

<div class="drawer">
	<input bind:checked={open} type="checkbox" class="drawer-toggle" />
	<div class="drawer-content">
		<button aria-label="open" onclick={() => (open = !open)} class="btn btn-square btn-ghost">
			<svg
				aria-label="Menu"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				class="inline-block h-5 w-5 stroke-current"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 6h16M4 12h16M4 18h16"
				></path>
			</svg>
		</button>
	</div>
	<div class="drawer-side">
		<label for="my-drawer-1" aria-label="close sidebar" class="drawer-overlay"></label>
		<div
			class="menu min-h-full w-80 bg-base-200 p-4"
			style="overflow-y: auto; position: relative;"
			bind:clientHeight={containerHeight}
			bind:this={container}
			onscroll={onScroll}
		>
			<ol style="height: {totalHeight}px; position: relative; list-style: none; padding: 0; margin: 0;">
				<div style="transform: translateY({offsetY}px);">
					{#each visibleItems as navItem (navItem.index)}
						<li style="height: {ITEM_HEIGHT}px; display: flex; align-items: center;">
							<button
								style="width: 100%; text-align: left; padding: 0 8px;"
								onclick={(e) => {
									e.preventDefault();
									open = false;
									changeSpineIndex(navItem.index);
								}}>{navItem.title}</button
							>
						</li>
					{/each}
				</div>
			</ol>
		</div>
	</div>
</div>
