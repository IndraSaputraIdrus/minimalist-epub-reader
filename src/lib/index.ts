// place files you want to import through the `$lib` alias in this folder.

	export type Manifest = Record<string, { href: string; mediaType: string }>;
	export type Spine = { id: string; href: string };
	export type NavItem = { index: number; href: string; title: string };


export function resolvePath(basePath: string, targetPath: string): string {
	const parts = targetPath.split('/');
	const parsePath: string[] = [];
	for (const part of parts) {
		if (part === '..' || part === '.') {
			continue;
		}
		parsePath.push(part);
	}

	return `${basePath}${parsePath.join('/')}`;
}

export function getMimeFromExtension(path: string): string {
	const ext = path.split('.').pop()?.toLowerCase() ?? '';
	const map: Record<string, string> = {
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		png: 'image/png',
		gif: 'image/gif',
		svg: 'image/svg+xml',
		webp: 'image/webp'
	};
	return map[ext] ?? 'application/octet-stream';
}
