type Props = {
  src: string;
  floated?: string;
  size?: string | number;
  className?: string;
};
export default function Image({ src, size, className }: Props) {
  const s = size === "mini" ? 30 : Number(size);
  return <img className={className} src={src} width={s} height={s} />;
}
