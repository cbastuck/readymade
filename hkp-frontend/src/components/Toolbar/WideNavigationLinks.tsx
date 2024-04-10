import { Link, useLocation } from "react-router-dom";

export default function NavigationLinks() {
  const location = useLocation();
  const links = [
    { name: "Docs", link: "/docs" },
    { name: "Examples", link: "/examples" },
    { name: "Playground", link: "/playground" },
  ];
  const defaultStyles = "rounded-md p-[5px] m-1 text-sm tracking-wider";
  const nonActivestyles = `${defaultStyles} "hover:text-zinc-500"`;
  const activeStyles = `bg-sky-600 text-white hover:text-neutral-200 ${defaultStyles}`;
  return (
    <div className="">
      {links.map(({ link, name }) => (
        <Link
          className={
            location.pathname.startsWith(link) ? activeStyles : nonActivestyles
          }
          key={link}
          to={link}
        >
          {name}
        </Link>
      ))}
    </div>
  );
}
