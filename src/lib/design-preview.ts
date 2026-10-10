export function isDesignPreview(): boolean {
  return (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_E2E_DESIGN_PREVIEW === 'true')
    && new URLSearchParams(window.location.search).get('preview') === 'design';
}

export function subscribeToLocationChanges(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  window.addEventListener('pageshow', onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener('pageshow', onChange);
  };
}
