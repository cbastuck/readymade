import { VSpaceType } from "./types";

export default function VSpace(item: VSpaceType) {
  const { size } = item;
  return <div style={{ height: size }} />;
}
