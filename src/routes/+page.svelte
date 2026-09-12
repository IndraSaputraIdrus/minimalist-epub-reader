<script lang="ts">
	import { getMimeFromExtension, resolvePath } from '$lib';
	import { unzipSync } from 'fflate';

	type Manifest = Record<string, { href: string; mediaType: string }>;
	type Spine = Array<{ id: string; href: string }>;

	let viewer = $state<HTMLDivElement | null>(null);
	let fileName = $state<string | null>(null);
	let title = $state<string | null>(null);

	let manifest: Manifest = {};
	let spine: Spine = $state([]);
	let basePath: string | null = null;

	const domParser = new DOMParser();

	const onFileChange = async (e: Event) => {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];

		if (!file) return;
		fileName = file.name;

		const buffer = await file.arrayBuffer();
		const files = unzipSync(new Uint8Array(buffer));

		const cXml = new TextDecoder().decode(files['META-INF/container.xml']);
		const cDoc = domParser.parseFromString(cXml, 'application/xml');

		const rootFileEl = cDoc.querySelector('rootfile');
		if (!rootFileEl) return;

		const opfPath = rootFileEl.getAttribute('full-path');
		if (!opfPath) return;

		basePath = opfPath.slice(0, opfPath.lastIndexOf('/') + 1);
		const opfXml = new TextDecoder().decode(files[opfPath]);
		const opfDoc = domParser.parseFromString(opfXml, 'application/xml');

		manifest = {};
		const manifestItems = opfDoc.querySelectorAll('manifest > item');
		for (const item of manifestItems) {
			const id = item.getAttribute('id') ?? '';
			const href = item.getAttribute('href');
			const mediaType = item.getAttribute('media-type') ?? '';
			manifest[id] = { href: href ? basePath.concat(href) : '', mediaType };
		}

		const metadataTitle = opfDoc.getElementsByTagName('dc:title')[0];
		if (metadataTitle) {
			title = metadataTitle.textContent;
		}

		const spineItems = opfDoc.querySelectorAll('spine > itemref');
		for (const sItem of spineItems) {
			const id = sItem.getAttribute('idref') ?? '';
			const href = manifest[id].href;
			spine.push({ id, href });
		}

		const currentSpine = spine[0];
		const currentFile = files[currentSpine.href];
		const raw = new TextDecoder().decode(currentFile);
		const doc = domParser.parseFromString(raw, 'application/xhtml+xml');

		const images = doc.querySelectorAll('img');
		for (const image of images) {
			const imageUrl = image.getAttribute('src') ?? '';
			const targetImage = resolvePath(basePath, imageUrl);

			const imageFile = files[targetImage];
            const fileName = targetImage.split("/").pop()
            if(!fileName) continue

			const mimeType = getMimeFromExtension(fileName);
			const blob = new Blob([imageFile], { type: mimeType });
			const newUrl = URL.createObjectURL(blob);

			image.setAttribute('src', newUrl);
		}

		const html = new XMLSerializer().serializeToString(doc);
		viewer!.innerHTML = html;
	};
</script>

<main class="flex min-h-dvh flex-col gap-5 p-5">
	<input
		onchange={onFileChange}
		class="border border-black bg-slate-300"
		id="epub-input"
		type="file"
		accept=".epub,application/epub+zip"
	/>
	<div class="h-32 border">{title ?? 'No title'}</div>
	<div bind:this={viewer} id="viewer" class="flex-1 border"></div>
</main>
