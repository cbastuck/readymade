import DropboxSourceDescriptor from '../services/DropboxSource';
import DropboxSinkDescriptor from '../services/DropboxSink';

export default function () {
  return [
    DropboxSourceDescriptor,
    DropboxSinkDescriptor,
  ];
}