<script lang="ts">
	import type { NavItem } from '$lib';

	let open = $state(false);

	type Props = {
		list: Array<NavItem>;
		changeSpineIndex: (index: number) => void;
	};

	let { list, changeSpineIndex }: Props = $props();
</script>

<div class="drawer">
	<input bind:checked={open} type="checkbox" class="drawer-toggle" />
	<div class="drawer-content">
		<!-- Page content here -->
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
		<ol class="menu min-h-full w-80 bg-base-200 p-4">
			{#each list as navItem}
				<li>
					<button
						onclick={(e) => {
							e.preventDefault();
                            open = false
							changeSpineIndex(navItem.index);
						}}>{navItem.title}</button
					>
				</li>
			{/each}
		</ol>
	</div>
</div>
