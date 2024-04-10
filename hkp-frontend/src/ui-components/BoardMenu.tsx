import React, { useContext } from "react";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { cn } from "@/ui-components";
import { BoardCtx } from "@/BoardContext";

type Props = {
  boardSyncActive: boolean;
};

export default function BoardMenu({}: Props) {
  const boardContext = useContext(BoardCtx);
  const board = boardContext?.boardName;
  return (
    <NavigationMenu className="" delayDuration={10000}>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger className="px-2 tracking-wider text-sm hover:text-white">
            {" "}
            {board || "Board"}
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
              <li className="row-span-5">
                <NavigationMenuLink asChild>
                  <a
                    className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                    href="/"
                  >
                    <div className="mb-2 mt-4 text-lg font-medium">
                      Hookup.to
                    </div>
                    <p className="text-sm leading-tight text-muted-foreground">
                      Hookup your ideas. Own the data. Own the process.
                    </p>
                  </a>
                </NavigationMenuLink>
              </li>
              <ListItem
                title="New Board"
                onClick={() =>
                  boardContext?.onAction({
                    type: "newBoard",
                  })
                }
              >
                Create a new board.
              </ListItem>
              <ListItem
                title="Clear Board"
                onClick={() =>
                  boardContext?.onAction({
                    type: "clearBoard",
                  })
                }
                disabled={
                  !boardContext ||
                  !boardContext.isActionAvailable({ type: "clearBoard" })
                }
              >
                Clear the current Board
              </ListItem>
              <ListItem title="Save Board">
                Save the current board to the browser
              </ListItem>
              <ListItem title="Board Source">
                Edit the current board's source in a text editor
              </ListItem>
              <ListItem title="Board Link">
                Create a link allowing to share and clone the board on another
                device
              </ListItem>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

const ListItem = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & { disabled?: boolean }
>(({ className, title, children, disabled, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <div
          ref={ref}
          className={cn(
            "cursor-pointer block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            className
          )}
          {...props}
        >
          <div className="text-sm font-medium leading-none underline">
            {title}
          </div>
          <p className="line-clamp-2 text-sm leading-snug  hover:text-accent-foreground">
            {children}
          </p>
        </div>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";
