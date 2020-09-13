export async function loadBundle(bundleId) {
  switch(bundleId) {
    case 'hookup.to/registry/browser/Audio':
      const { default: audioRegistry } = await import('./registry/Audio');
      return audioRegistry();
    case 'hookup.to/registry/browser/Graphic':
      const { default: graphicRegistry } = await import('./registry/Graphic');
      return graphicRegistry();
    case 'hookup.to/registry/browser/Statistic':
      const { default: statisticRegistry } = await import('./registry/Statistic');
      return statisticRegistry();
    default:
      console.error('Unknown registry-bundle', bundleId);
      return [];
  }
}