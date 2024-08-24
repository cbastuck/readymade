import { Link, useLocation } from "react-router-dom";

type Props = {
  isCompact?: boolean;
};
export default function NavigationBar({ isCompact }: Props) {
  const location = useLocation();
  const links = [
    { name: "Docs", link: "/docs" },
    //{ name: "Examples", link: "/examples" },
    { name: "Playground", link: "/playground" },
    { name: "Home", link: "/home" },
  ];
  const defaultStyles =
    "font-sans rounded-md p-[5px] m-1 text-base tracking-widest hover:no-underline";
  const nonActivestyles = `${defaultStyles} "hover:text-zinc-500"`;
  const activeStyles = `bg-sky-600 text-white hover:text-neutral-200 ${defaultStyles}`;

  if (isCompact) {
    return null;
  }
  return (
    <div
      style={{
        marginTop: 10,
        width: "100%",
        textAlign: "right",
        marginRight: 10,
      }}
    >
      <div>
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
