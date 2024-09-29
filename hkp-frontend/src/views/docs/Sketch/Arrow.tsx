import { ChevronRight } from "lucide-react";

export default function Arrow({ className }: { className?: string }) {
  return (
    <div className={`${className} max-w-[30px]`}>
      <ChevronRight style={{ margin: 5 }} />
    </div>
  );
}
