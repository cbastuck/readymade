import { ServiceModule } from "../types";

export async function loadBundle(
  bundleId: string,
): Promise<Array<ServiceModule>> {
  switch (bundleId) {
    default:
      console.error("Unknown registry-bundle", bundleId);
      return [];
  }
}
