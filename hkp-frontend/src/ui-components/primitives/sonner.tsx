import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          error: "text-red-400",
          success: "text-green-700",
          warning: "text-yellow-400",
          info: "text-blue-400",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-white group-[.toast]:text-black hover:group-[.toast]:bg-sky-100 group-[.toast]:border-solid group-[.toast]:border group-[.toast]:border-slate-500",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "group-[.toast]:bg-white group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
