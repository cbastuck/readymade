import { Link, useLocation } from "react-router-dom";

type Props = {
  isCompact?: boolean;
};
export default function NavigationBar({ isCompact }: Props) {
  const location = useLocation();
  const links = [
    { name: "Home", link: "/home" },
    { name: "Docs", link: "/docs" },
    //{ name: "Examples", link: "/examples" },
    { name: "Playground", link: "/playground" },
  ];
  const defaultStyles =
    "font-sans rounded-md p-[5px] mx-1 text-base tracking-widest hover:no-underline";
  const nonActivestyles = `${defaultStyles} "hover:text-zinc-500"`;
  const activeStyles = `bg-sky-600 text-white hover:text-neutral-200 ${defaultStyles}`;

  if (isCompact) {
    return null;
  }
  return (
    <div
      className="flex w-full"
      style={{
        textAlign: "right",
      }}
    >
      <div className="ml-auto">
        {links.map(({ link, name }) => (
          <Link
            className={
              location.pathname.startsWith(link)
                ? activeStyles
                : nonActivestyles
            }
            key={link}
            to={link}
          >
            {name}
          </Link>
        ))}
      </div>
    </div>
  );
}
