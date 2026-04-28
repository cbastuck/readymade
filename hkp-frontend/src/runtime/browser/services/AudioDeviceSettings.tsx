import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "hkp-frontend/src/ui-components/primitives/table";

import { Button } from "hkp-frontend/src/ui-components/primitives/button";

export type AudioInputDevice = {
  kind: "audioinput";
  label: string;
  deviceId: string;
};

type Props = {
  devices?: Array<AudioInputDevice>;
  onActivate: (device: AudioInputDevice) => void;
};

export default function AudioDeviceSettings({
  devices = [],
  onActivate,
}: Props) {
  return (
    <div className="flex flex-col">
      <div className="font-sans my-2">
        Found following list of devices in your system
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-sans text-base">Device</TableHead>
            <TableHead className="font-sans text-base text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {devices
            .filter((device) => device.kind === "audioinput")
            .map((device) => (
              <TableRow key={device.label}>
                <TableCell className="text-base">{device.label}</TableCell>
                <TableCell className="text-base text-right">
                  <Button variant="outline" onClick={() => onActivate(device)}>
                    Activate
                  </Button>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
