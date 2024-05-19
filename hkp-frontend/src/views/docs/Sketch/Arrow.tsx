import { ChevronRight } from "lucide-react";

type Props = {
  yOffset: number;
};

export default function Arrow({ yOffset }: Props) {
  return <ChevronRight style={{ margin: 5, marginTop: yOffset }} />;
}
