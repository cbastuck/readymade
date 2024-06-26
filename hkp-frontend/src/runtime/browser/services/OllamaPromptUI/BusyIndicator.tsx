type Props = {
  isBusy: boolean;
};

export default function BusyIndicator({ isBusy }: Props) {
  return (
    <span className="relative flex h-3 w-3 mb-2 pt-1">
      {isBusy && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
      )}
      <span
        className={`relative inline-flex rounded-full h-3 w-3 ${
          isBusy ? "bg-sky-500" : "bg-gray-200"
        }`}
      />
    </span>
  );
}
