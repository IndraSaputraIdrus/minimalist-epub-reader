import { getMimeFromExtension, resolvePath, type Manifest, type Spine } from '$lib/utils';
import { unzip, type Unzipped } from 'fflate';

export class EpubParser {
	decode(input: AllowSharedBufferSource) {
		return new TextDecoder().decode(input);
	}

	domParse(raw: string) {
		return new DOMParser().parseFromString(raw, 'application/xhtml+xml');
	}

	async unzipEpub(file: ArrayBuffer) {
		return new Promise<Unzipped>((resolve, reject) => {
			unzip(new Uint8Array(file), (error, data) => {
				if (error) reject(error);
				resolve(data);
			});
		});
	}

	getOpf(files: Unzipped): { opfPath: string; opfDoc: Document } {
		const cXml = this.decode(files['META-INF/container.xml']);
		const cDoc = this.domParse(cXml);

		const rootFileEl = cDoc.querySelector('rootfile');
		if (!rootFileEl) throw new Error('Rootfile element is not found');

		const opfPath = rootFileEl.getAttribute('full-path');
		if (!opfPath) throw new Error('Opf path is not found');

		const opfXml = this.decode(files[opfPath]);
		const opfDoc = this.domParse(opfXml);

		return {
			opfPath,
			opfDoc
		};
	}

	extractManifest(opfDoc: Document): Manifest {
		const manifest: Manifest = {};
		const manifestItems = opfDoc.querySelectorAll('manifest > item');
		for (const item of manifestItems) {
			const id = item.getAttribute('id') ?? '';
			const href = item.getAttribute('href');
			const mediaType = item.getAttribute('media-type') ?? '';
			manifest[id] = { href: href ?? '', mediaType };
		}
		return manifest;
	}

	extractTitle(opfDoc: Document): string | null {
		const metadataTitle = opfDoc.getElementsByTagName('dc:title')[0];
		if (!metadataTitle) return null;
		return metadataTitle.textContent;
	}

	extractSpine(opfDoc: Document, manifest: Manifest): Array<Spine> {
		const spineItems = opfDoc.querySelectorAll('spine > itemref');
		const spine: Array<Spine> = [];
		for (const sItem of spineItems) {
			const id = sItem.getAttribute('idref') ?? '';
			const href = manifest[id].href;
			spine.push({ id, href });
		}
		return spine;
	}

	resolveImage(doc: Document, basePath: string, files: Unzipped) {
		const images = doc.querySelectorAll('img, image');
		const result: Array<string> = [];
		for (const image of images) {
			const isSvgImage = image.tagName.toLowerCase() === 'image';

			let rawUrl: string | null = null;
			if (isSvgImage) {
				rawUrl = image.getAttribute('xlink:href') ?? image.getAttribute('href');
			} else {
				rawUrl = image.getAttribute('src');
			}

			if (!rawUrl || rawUrl.startsWith('http') || rawUrl.startsWith('data')) continue;
			const path = resolvePath(basePath, rawUrl);
			const fileName = path.split('/').pop();
			if (!fileName) continue;

			const imageFile = files[path];
			const mimeType = getMimeFromExtension(fileName);

			const blob = new Blob([imageFile], { type: mimeType });
			const blobUrl = URL.createObjectURL(blob);

			if (isSvgImage) {
				image.removeAttribute('xlink:href');
				image.setAttribute('href', blobUrl);
			} else {
				image.setAttribute('src', blobUrl);
			}

			result.push(blobUrl);
		}

		return result;
	}

	resolveStyleSheet(
		doc: Document,
		basePath: string,
		files: Unzipped,
		cache: Map<string, CSSStyleSheet>
	): CSSStyleSheet[] {
		const sheets: CSSStyleSheet[] = [];
		const links = doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]');

		for (const link of links) {
			const href = link.getAttribute('href');
			if (!href) continue;

			const path = resolvePath(basePath, href);
			let sheet = cache.get(path);

			if (!sheet) {
				const cssFile = files[path];
				if (!cssFile) continue;

				sheet = new CSSStyleSheet();
				sheet.replaceSync(this.decode(cssFile));

				cache.set(path, sheet);
			}

			sheets.push(sheet);
			link.remove();
		}

		return sheets;
	}
}
