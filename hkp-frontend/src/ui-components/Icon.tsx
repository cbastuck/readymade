type Props = {
  className?: string;
  value: React.ComponentType<any>;
};

export default function Icon({
  className = "hover:stroke-black",
  value: IconComponent,
}: Props) {
  return <IconComponent className={className} size={16} />;
}
