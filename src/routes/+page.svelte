<script lang="ts">
	import { getMimeFromExtension, resolvePath, type Manifest, type Spine, type NavItem } from '$lib';
	import { unzipSync, type Unzipped } from 'fflate';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { tick } from 'svelte';
	import SideBar from '$lib/components/sideBar.svelte';

	let isReady = $state(false);

	let viewer = $state<HTMLDivElement | null>(null);
	let shadowRoot: ShadowRoot | null = null;

	let fileName = $state<string | null>(null);
	let title = $state<string | null>(null);

	let manifest: Manifest = {};
	let spine: Array<Spine> = $state([]);
	let basePath: string | null = null;

	let currentIndex = $derived(Number(page.url.searchParams.get('index') ?? 0));
	let list = $state<Array<NavItem>>([]);

	const domParser = new DOMParser();
	let files: Unzipped | null = null;

	const onFileChange = async (e: Event) => {
		isReady = false;
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];

		if (!file) return;
		fileName = file.name;

		const buffer = await file.arrayBuffer();
		files = unzipSync(new Uint8Array(buffer));

		const cXml = new TextDecoder().decode(files['META-INF/container.xml']);
		const cDoc = domParser.parseFromString(cXml, 'application/xml');

		const rootFileEl = cDoc.querySelector('rootfile');
		if (!rootFileEl) return;

		const opfPath = rootFileEl.getAttribute('full-path');
		if (!opfPath) return;

		basePath = opfPath.slice(0, opfPath.lastIndexOf('/') + 1);
		const opfXml = new TextDecoder().decode(files[opfPath]);
		const opfDoc = domParser.parseFromString(opfXml, 'application/xml');

		manifest = getManifest(opfDoc);
		title = getTitle(opfDoc);
		spine = getSpine(opfDoc);

		const navXml = new TextDecoder().decode(files[manifest['nav'].href]);
		const navDoc = domParser.parseFromString(navXml, 'application/xhtml+xml');
		list = getList(navDoc);

		isReady = true;
		tick().then(() => {
			renderChapter();
		});
	};

	function getList(navDoc: Document): Array<NavItem> {
		const items = navDoc.querySelectorAll('li > a');
		const result: Array<NavItem> = [];
		for (const [index, item] of items.entries()) {
			if (index === 0) {
				result.push({ index, href: 'cover.xhtml', title: 'Cover page' });
			}

			const href = item.getAttribute('href');
			if (!href) continue;

			const title = item.textContent;
			if (!title) continue;

			result.push({ index: index + 1, href, title });
		}

		return result;
	}

	function getManifest(opfDoc: Document): Manifest {
		if (!basePath) return {};

		const manifest: Manifest = {};
		const manifestItems = opfDoc.querySelectorAll('manifest > item');
		for (const item of manifestItems) {
			const id = item.getAttribute('id') ?? '';
			const href = item.getAttribute('href');
			const mediaType = item.getAttribute('media-type') ?? '';
			manifest[id] = { href: href ? basePath.concat(href) : '', mediaType };
		}

		return manifest;
	}

	function getSpine(opfDoc: Document): Array<Spine> {
		const spineItems = opfDoc.querySelectorAll('spine > itemref');
		const spine: Array<Spine> = [];
		for (const sItem of spineItems) {
			const id = sItem.getAttribute('idref') ?? '';
			const href = manifest[id].href;
			spine.push({ id, href });
		}

		return spine;
	}

	function getTitle(opfDoc: Document): string | null {
		const metadataTitle = opfDoc.getElementsByTagName('dc:title')[0];
		if (!metadataTitle) return null;
		return metadataTitle.textContent;
	}

	function renderChapter(): void {
		if (!files) return;
		const currentSpine = spine[currentIndex];
		const currentFile = files[currentSpine.href];
		const raw = new TextDecoder().decode(currentFile);
		const doc = domParser.parseFromString(raw, 'application/xhtml+xml');

		if (!basePath) return;
		const images = doc.querySelectorAll('img, image');
		for (const image of images) {
			const imageUrl = image.getAttribute('src') ?? '';
			const targetImage = resolvePath(basePath, imageUrl);

			const imageFile = files[targetImage];
			const fileName = targetImage.split('/').pop();
			if (!fileName) continue;

			const mimeType = getMimeFromExtension(fileName);
			const blob = new Blob([imageFile], { type: mimeType });
			const newUrl = URL.createObjectURL(blob);

			image.setAttribute('src', newUrl);
		}

		const html = new XMLSerializer().serializeToString(doc);
		if (!shadowRoot) {
			shadowRoot = viewer!.attachShadow({ mode: 'closed' });
		}
		shadowRoot.innerHTML = '';
		shadowRoot.innerHTML = html;
		viewer!.scrollTop = 0;
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
		currentIndex = 0;
		goto(`?index=${currentIndex}`).then(() => renderChapter());
	}

	function changeSpineIndex(index: number) {
		if (index < 0 && index > spine.length + 1) return;
		goto(`?index=${index}`).then(() => renderChapter());
	}

	$inspect(isReady);
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
				onchange={onFileChange}
				class="file-input file-input-sm md:file-input-md"
				id="epub-input"
				type="file"
				accept=".epub,application/epub+zip"
			/>
		</div>
		<div class="flex-none">
			{#if isReady}
				<SideBar {changeSpineIndex} {list} />
			{/if}
		</div>
	</div>
{/snippet}

<main class="container mx-auto flex min-h-dvh flex-col gap-7 p-5">
	<!-- <div class="flex items-center justify-center"></div> -->
	{@render Navbar()}
	{#if isReady}
		{#if title}
			<div>
				<h1 class="text-center text-2xl font-bold">
					{title ?? 'No title'}
				</h1>
			</div>
		{/if}
		<div class="mx-auto max-w-3xl flex-1 space-y-10">
			{@render Navigation()}
			<div bind:this={viewer} id="viewer"></div>
			{@render Navigation()}
		</div>
	{/if}
</main>
