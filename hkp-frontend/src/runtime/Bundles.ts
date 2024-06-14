import { ServiceModule } from "../types";

export async function loadBundle(
  bundleId: string
): Promise<Array<ServiceModule>> {
  switch (bundleId) {
    case "hookup.to/registry/browser/Audio":
      const { default: audioRegistry } = await import(
        "audio-registry/src/audio"
      );
      return audioRegistry();

    case "hookup.to/registry/browser/Graphic":
      const { default: graphicRegistry } = await import(
        "graphic-registry/src/graphic"
      );
      return graphicRegistry();

    case "hookup.to/registry/browser/Fileformat":
      const { default: fileformatRegistry } = await import(
        "fileformat-registry/src/fileformat"
      );
      return fileformatRegistry();

    case "hookup.to/registry/browser/Crypto":
      const { default: cryptoRegistry } = await import(
        "crypto-registry/src/crypto"
      );
      return cryptoRegistry();

    case "hookup.to/registry/browser/FileStorage":
      const { default: fileStorageRegistry } = await import(
        "storage-registry/src/storage"
      );
      return fileStorageRegistry();

    case "hookup.to/registry/browser/TensorFlow":
      const { default: tensorFlowRegistry } = await import(
        "tensorflow-registry/src/tensorflow"
      );
      return tensorFlowRegistry();

    default:
      console.error("Unknown registry-bundle", bundleId);
      return [];
  }
}
