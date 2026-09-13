<script lang="ts">
	import { type Manifest, type Spine } from '$lib/utils';
	import { type Unzipped } from 'fflate';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { tick } from 'svelte';
	import { EpubParser } from '$lib/epub';

	let fileName: string | null = null;
	let shadowRoot: ShadowRoot | null = null;
	let basePath: string = '';
	let files: Unzipped | null = null;
    
	const currentIndex = $derived(Number(page.url.searchParams.get('index') ?? 0));

	let status = $state<'loading' | 'ready' | 'done'>('ready');
	let viewer = $state<HTMLDivElement | null>(null);
	let title = $state<string | null>(null);

	let spine: Array<Spine> = $state([]);
	let manifest: Manifest = {};
	let activeBlobUrls: string[] = [];

	const cssCache: Map<string, CSSStyleSheet> = new Map();
	const epub = new EpubParser();

	function revokeBlobUrls(): void {
		for (const url of activeBlobUrls) {
			URL.revokeObjectURL(url);
		}
		activeBlobUrls = [];
	}

	const onFileChange = async (e: Event) => {
		try {
			status = 'loading';

			revokeBlobUrls();

			const target = e.target as HTMLInputElement;
			const file = target.files?.[0];

			if (!file) throw new Error('File is not found');
			fileName = file.name;
			const buffer = await file.arrayBuffer();

			files = await epub.unzipEpub(buffer);
			const { opfPath, opfDoc } = epub.getOpf(files);

			basePath = opfPath.slice(0, opfPath.lastIndexOf('/') + 1);

			manifest = epub.extractManifest(opfDoc);
			title = epub.extractTitle(opfDoc);
			spine = epub.extractSpine(opfDoc, manifest);

			status = 'done';
			await tick();
			renderChapter();
		} catch (e) {
			console.log(e);
			status = 'done';
		} finally {
			status = 'done';
		}
	};

	function renderChapter(): void {
		if (!files || !viewer) return;
		const currentSpine = spine[currentIndex];
		const currentFile = files[currentSpine.href];

		const raw = epub.decode(currentFile);
		const doc = epub.domParse(raw);

		const images = epub.resolveImage(doc, basePath, files);
		const sheets = epub.resolveStyleSheet(doc, basePath, files, cssCache);

		activeBlobUrls = activeBlobUrls.concat(images);

		if (!shadowRoot) {
			shadowRoot = viewer.attachShadow({ mode: 'open' });
		}

		shadowRoot.adoptedStyleSheets = sheets;
		shadowRoot.innerHTML = doc.body.innerHTML ?? doc.documentElement.innerHTML;
		viewer.scrollTop = 0;
	}

	function prevIndex() {
		if (currentIndex < 0) return;
		goto(`?index=${currentIndex - 1}`).then(() => renderChapter());
	}
	function nextIndex() {
		if (currentIndex > spine.length + 1) return;
		goto(`?index=${currentIndex + 1}`).then(() => renderChapter());
	}

	function resetIndex() {
		goto(`?index=0`).then(() => renderChapter());
	}

	$effect(() => {
		if (currentIndex) {
			revokeBlobUrls();
		}
	});
</script>

{#snippet Navigation()}
	<div class="join grid grid-cols-3">
		<button class="btn join-item btn-soft btn-primary" onclick={prevIndex}>Prev</button>
		<button class="btn join-item btn-soft btn-secondary" onclick={resetIndex}>Reset</button>
		<button class="btn join-item btn-soft btn-primary" onclick={nextIndex}>Next</button>
	</div>
{/snippet}

{#snippet Navbar()}
	<div class="navbar gap-5 bg-base-100">
		<div class="flex-1">
			<input
				disabled={status === 'done'}
				onchange={onFileChange}
				class="file-input file-input-sm md:file-input-md"
				id="epub-input"
				type="file"
				accept=".epub,application/epub+zip"
			/>
		</div>
	</div>
{/snippet}

<main class="container mx-auto flex min-h-dvh flex-col gap-7 p-5">
	{@render Navbar()}
	{#if status === 'done'}
		{#if title}
			<div>
				<h1 class="text-center text-2xl font-bold">
					{title ?? 'No title'}
				</h1>
			</div>
		{/if}
		<div class="mx-auto w-full max-w-3xl flex-1 space-y-10">
			{@render Navigation()}
			<div bind:this={viewer} id="viewer"></div>
			{@render Navigation()}
		</div>
	{:else if status === 'loading'}
		<div class="flex h-full w-full items-center justify-center">
			<p>Loading...</p>
		</div>
	{/if}
</main>
