import { HeadlineType } from "./types";

export default function Headline(item: HeadlineType) {
  return <h2>{item.text}</h2>;
}
