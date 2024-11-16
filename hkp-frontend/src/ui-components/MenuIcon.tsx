type Props = {
  icon: JSX.ElementType;
  className?: string;
};

export default function MenuIcon({ icon: Icon, className }: Props) {
  return <Icon className={`mr-2 h-4 w-4 ${className}`} />;
}
