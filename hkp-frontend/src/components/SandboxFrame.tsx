type Action = {
  page: string;
  finished: boolean;
  checkpoint: string;
};

type Props = {
  title: string;
  src: string;
  maxWidth: number;
  frameless: string | boolean;
  frameBorder: string | number;
  height: string;
  width: string;
  onAction: (action: Action) => any;
};

export default function SandboxFrame({
  title,
  src,
  maxWidth,
  frameless = "false",
  frameBorder = "0",
  height = "100%",
  width = "100%",
  onAction,
}: Props) {
  const style = {
    height,
    width,
    maxWidth: maxWidth ? maxWidth : undefined,
  };

  if (!src) {
    console.warn("Sandbox component without src");
    return null;
  }

  return (
    <iframe
      title={title}
      src={`/sandbox?src=${src}&frameless=${frameless}`}
      style={{ border: frameBorder, ...style }}
      ref={(frame: any) => {
        if (frame && onAction) {
          frame.onAction = onAction;
        }
      }}
    />
  );
}
