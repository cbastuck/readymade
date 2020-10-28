import PlotterDescriptor from '../services/Plotter';
import ThreeViewersDescriptor from '../services/ThreeViewer';
import GIFEncoderDescriptor from '../services/GIFEncoder';

export default function () {
  return [
    PlotterDescriptor,
    ThreeViewersDescriptor,
    GIFEncoderDescriptor,
  ];
}