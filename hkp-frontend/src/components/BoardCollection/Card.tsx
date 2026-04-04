import { ReactElement } from "react";
import { Link } from "react-router-dom";

import Image from "hkp-frontend/src/ui-components/Image";
import { GitBranch } from "lucide-react";

import Description from "./Description";
import { SavedBoard, UsecaseDescriptor } from "../../types";
import Button from "hkp-frontend/src/ui-components/Button";

export type Action = { name: string; icon: ReactElement };
type Props = {
  value: UsecaseDescriptor | SavedBoard;
  actions?: Array<Action>;
  onAction?: (action: Action, item: UsecaseDescriptor | SavedBoard) => void;
};

export default function Card({ value: item, actions, onAction }: Props) {
  const { url, name, description, image, repo } = item as UsecaseDescriptor;
  return (
    <div
      key={`board-card-${name}`}
      className="hkp-card-border tracking-wider flex flex-col p-6"
      style={{
        minWidth: 200,
        margin: 10,
      }}
    >
      <div className="flex">
        <h4>
          <Link className="hover:no-underline" to={url}>
            {name}
          </Link>
        </h4>
        {!repo ? (
          <Image
            size="mini"
            src={image || "/assets/shutterstock_1196210650.png"}
          />
        ) : (
          <div className="ml-auto border p-[2px] rounded-full border-sky-600">
            <a
              className="ml-auto hover:no-underline"
              href={repo}
              target="_blank"
              rel="noreferrer"
            >
              <GitBranch size={16} />
            </a>
          </div>
        )}
      </div>

      <div style={{ marginTop: 10 }}>
        <Link className="hover:no-underline" to={url}>
          <Description name={name} description={description} />
        </Link>
        <div className="mt-2">
          {actions && (
            <>
              {actions.map((action) => (
                <Button
                  key={action.name}
                  onClick={(ev) => {
                    onAction?.(action, item);
                    ev.stopPropagation();
                    ev.preventDefault();
                  }}
                  icon={action.icon}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
