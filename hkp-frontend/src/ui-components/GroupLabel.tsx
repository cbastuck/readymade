type Props = {
  children: string;
};

export default function GroupLabel({ children }: Props) {
  return <h3 className="text-left tracking-[6px] text-base">{children}</h3>;
}
