/** `/content-manager/collection-types/api::page.page/abc123` → `api::page.page` */
export const uidFromPath = (pathname: string): string | null => {
  const match = /\/content-manager\/(?:collection-types|single-types)\/([^/?#]+)/.exec(pathname);
  return match ? decodeURIComponent(match[1]) : null;
};
