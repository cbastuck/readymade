type Props = {
  children: string | JSX.Element | Array<JSX.Element | string>;
};

export default function CardText({ children }: Props) {
  return (
    <div className="font-menu tracking-widest text-left text-base">
      {children}
    </div>
  );
}
