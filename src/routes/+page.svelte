<script lang="ts">
	import { getMimeFromExtension, resolvePath } from '$lib';
	import { unzipSync, type Unzipped } from 'fflate';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	type Manifest = Record<string, { href: string; mediaType: string }>;
	type Spine = { id: string; href: string };
	type NavItem = { index: number; href: string; title: string };

	let viewer = $state<HTMLDivElement | null>(null);
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

		renderChapter();
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
		const images = doc.querySelectorAll('img');
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
		viewer!.innerHTML = html;
	}

	function prevButton() {
		if (currentIndex < 0) return;
		goto(`?index=${currentIndex - 1}`).then(() => renderChapter());
	}

	function nextButton() {
		if (currentIndex > spine.length + 1) return;
		goto(`?index=${currentIndex + 1}`).then(() => renderChapter());
	}

	function changeSpineIndex(index: number) {
		if (index < 0 && index > spine.length + 1) return;
		goto(`?index=${index}`).then(() => renderChapter());
	}

	$inspect(currentIndex);
</script>

<main class="flex min-h-dvh flex-col gap-5 p-5">
	<input
		onchange={onFileChange}
		class="border border-black bg-slate-300"
		id="epub-input"
		type="file"
		accept=".epub,application/epub+zip"
	/>
	<div class="h-32 border">
		<p>
			{title ?? 'No title'}
		</p>
		<div class="flex gap-2">
			<button class="rounded bg-red-200 px-4 py-2 text-red-500" onclick={prevButton}>Prev</button>
			<button class="rounded bg-red-200 px-4 py-2 text-red-500" onclick={nextButton}>Next</button>
		</div>
	</div>
	<div class="grid flex-1 grid-cols-2 gap-5">
		<div bind:this={viewer} id="viewer" class="border">test</div>
		<div class="border">
			<ul>
				{#each list as item}
					<li>
						<button class="hover:opacity-80" onclick={() => changeSpineIndex(item.index)}
							>{item.index} {item.title}</button
						>
					</li>
				{/each}
			</ul>
		</div>
	</div>
</main>
