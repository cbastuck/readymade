type Props = {
  value: object;
};
export default function JSONCode({ value }: Props) {
  return (
    <pre className="mx-4 bg-[#fafafa] p-2 rounded border border-gray-200 w-fit">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
