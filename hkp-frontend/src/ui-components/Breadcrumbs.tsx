import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";

export type BreadcrumbItem = {
  value: string;
  link?: string;
};

type Props = {
  path: Array<BreadcrumbItem>;
};

export default function Breadcrumbs({ path }: Props) {
  return (
    <Breadcrumb className="font-sans mt-6">
      <BreadcrumbList>
        {path.map((p, idx) => (
          <>
            <BreadcrumbItem className="capitalize">
              {p.link ? (
                <Link to={p.link}>{p.value}</Link>
              ) : (
                <span>{p.value}</span>
              )}
            </BreadcrumbItem>
            {idx + 1 < path.length && <BreadcrumbSeparator />}
          </>
        ))}

        {/*
        <BreadcrumbItem>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1">
              <BreadcrumbEllipsis className="h-4 w-4" />
              <span className="sr-only">Toggle menu</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem>Documentation</DropdownMenuItem>
              <DropdownMenuItem>Themes</DropdownMenuItem>
              <DropdownMenuItem>GitHub</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        */}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
