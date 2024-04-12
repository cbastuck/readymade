import { Link, useLocation } from "react-router-dom";

export default function NavigationBar() {
  const location = useLocation();
  const links = [
    { name: "Docs", link: "/docs" },
    { name: "Examples", link: "/examples" },
    { name: "Playground", link: "/playground" },
  ];
  const defaultStyles =
    "font-sans rounded-md p-[5px] m-1 text-sm tracking-wider hover:no-underline";
  const nonActivestyles = `${defaultStyles} "hover:text-zinc-500"`;
  const activeStyles = `bg-sky-600 text-white hover:text-neutral-200 ${defaultStyles}`;
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
