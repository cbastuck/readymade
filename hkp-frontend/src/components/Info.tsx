type Props = {
  className?: string;
  headline: string;
  children: JSX.Element | Array<JSX.Element | string> | string;
};

export default function Info({ className, headline, children }: Props) {
  // Match the app UI rather than the Tailwind config's `serif` slot, which
  // points at an unregistered family and falls through to the browser's Times.
  const uiFont = '"DM Sans", system-ui, sans-serif';
  return (
    <div className={`${className} m-2`}>
      {headline && (
        <h1
          className="m-2 text-base font-semibold tracking-normal"
          style={{ fontFamily: uiFont }}
        >
          {headline}
        </h1>
      )}
      <div
        className="text-base mx-4 my-2 p-2"
        style={{ fontFamily: uiFont }}
      >
        {children}
      </div>
    </div>
  );
}
