type Props = {
  children: JSX.Element | JSX.Element[];
};

export default function Code({ children }: Props) {
  return (
    <code>
      <pre style={{ fontSize: "14px" }}>{children}</pre>
    </code>
  );
}
