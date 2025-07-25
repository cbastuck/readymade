import { TriangleAlert } from "lucide-react";
import Alert from "hkp-frontend/src/ui-components/Alert";

type Props = {
  boardName: string;
  error: Error;
};
export default function BoardFetchError({ boardName, error }: Props) {
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        height: "100%",
        position: "fixed",
        width: "100%",
      }}
    >
      <h1>
        Restoring "<span className="capitalize">{boardName}</span>" failed
      </h1>
      <div className="p-10 w-[80%] mx-auto">
        <Alert
          className="w-full text-red-400 font-serif"
          title="Error"
          icon={<TriangleAlert className="h-4 w-4" />}
        >
          {error.message}
        </Alert>
      </div>
    </div>
  );
}
