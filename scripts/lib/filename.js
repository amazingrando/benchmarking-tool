export const slugFromUrl = (url) => {
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname.replace(/^www\./, '').replaceAll('.', '-');
    const pathName = urlObj.pathname
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return pathName ? `${host}-${pathName}` : host;
  } catch {
    return String(url)
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./, '')
      .replaceAll('.', '-')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
};
