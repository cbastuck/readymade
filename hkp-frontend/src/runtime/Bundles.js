export async function loadBundle(bundleId) {
  switch (bundleId) {
    case "hookup.to/registry/browser/Audio":
      const { default: audioRegistry } = await import(
        "audio-registry/src/index"
      );
      return audioRegistry();
    case "hookup.to/registry/browser/Graphic":
      const { default: graphicRegistry } = await import(
        "graphic-registry/src/index"
      );
      return graphicRegistry();

    /*
    case "hookup.to/registry/browser/Statistic":
      const { default: statisticRegistry } = await import(
        "./registry/Statistic"
      );
      return statisticRegistry();
*/
    case "hookup.to/registry/browser/FileStorage":
      const { default: fileStorageRegistry } = await import(
        //"storage-registry/build/static/js/fileRegistry"
        "storage-registry/src/index"
      );
      return fileStorageRegistry();

    default:
      console.error("Unknown registry-bundle", bundleId);
      return [];
  }
}
