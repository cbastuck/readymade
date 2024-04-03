import { useState } from "react";

type Props = {
  renderHeadline?: boolean;
};

export default function RuntimeHeader({ renderHeadline }: Props) {
  const [showSettings, setShowSettings] = useState(false);
  return <div>Runtime Header</div>;
}
