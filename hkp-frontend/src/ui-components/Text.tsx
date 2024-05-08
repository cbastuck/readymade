import { CSSProperties, ReactElement } from "react";

type Props = {
  children: ReactElement | string | Array<string | ReactElement>;
  className?: string;
  style?: CSSProperties;
  yMargin?: number;
};
export default function Text({
  children,
  className,
  style,
  yMargin = 4,
}: Props) {
  return (
    <div
      style={style}
      className={`my-${yMargin} font-serif text-paragraph-color leading-[1.5rem] tracking-[1.6px] text-base ${className}`}
    >
      {children}
    </div>
  );
}
