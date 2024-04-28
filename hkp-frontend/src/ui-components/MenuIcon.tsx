type Props = {
  icon: JSX.ElementType;
};

export default function MenuIcon({ icon: Icon }: Props) {
  return <Icon className="mr-2 h-4 w-4" />;
}
