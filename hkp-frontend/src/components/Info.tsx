type Props = {
  className?: string;
  headline: string;
  children: JSX.Element | Array<JSX.Element | string> | string;
};

export default function Info({ className, headline, children }: Props) {
  return (
    <div className={`${className} m-2`}>
      {headline && <h1 className="m-2">{headline}</h1>}
      <div className="text-base mx-4 my-2 p-2 tracking-wider font-serif">
        {children}
      </div>
    </div>
  );
}
