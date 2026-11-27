export function slugFromProductName(name: string): string {
    return name
        .normalize('NFKD')
        .toLowerCase()
        .replace(/\p{M}+/gu, '')
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .slice(0, 200)
        .replace(/^-+|[^\p{L}\p{N}]+$/gu, '');
}
