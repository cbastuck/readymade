import ChartDescriptor from "../services/Chart";
import ThreeViewersDescriptor from "../services/ThreeViewer";
import GIFEncoderDescriptor from "../services/GIFEncoder";

export default function graphicRegistry() {
  return [ChartDescriptor, ThreeViewersDescriptor, GIFEncoderDescriptor];
}
