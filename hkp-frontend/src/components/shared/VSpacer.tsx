type Props = {
  height?: number | string;
};

export default function VSpacer({ height = 25 }: Props): JSX.Element {
  return <div style={{ height: Number(height) }} />;
}
