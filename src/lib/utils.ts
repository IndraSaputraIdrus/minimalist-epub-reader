export type Manifest = Record<string, { href: string; mediaType: string }>;
export type Spine = { id: string; href: string };
export type NavItem = { index: number; href: string; title: string };

export function resolvePath(basePath: string, targetPath: string): string {
	const base = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
	const segments = [...base.split('/'), ...targetPath.split('/')];
	const resolved: string[] = [];
	for (const seg of segments) {
		if (seg === '.' || seg === '') continue;
		if (seg === '..') {
			resolved.pop();
		} else {
			resolved.push(seg);
		}
	}
	return resolved.join('/');
}

const MIME_MAP: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	gif: 'image/gif',
	svg: 'image/svg+xml',
	webp: 'image/webp',
	css: 'text/css'
};

export function getMimeFromExtension(path: string): string {
	const ext = path.split('.').pop()?.toLowerCase() ?? '';
	return MIME_MAP[ext] ?? 'application/octet-stream';
}
