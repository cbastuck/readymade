export async function loadBundle(bundleId) {
  switch(bundleId) {
    case 'hookup.to/registry/browser/Audio':
      const { default: r } = await import('./registry/Audio');
      return r();
    default:
      console.error('Unknown registry-bundle', bundleId);
      return [];
  }
}