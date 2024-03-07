import { useParams } from "react-router-dom";

import Collaboration from "./collaboration";
import Nesting from "./nesting";
import Slideshow from "./slideshow";
import Game from "./game";

export default function Blog() {
  const { article } = useParams();
  if (!article) {
    return `Invalid article: ${article}`;
  }
  const Article = getArticle(article);
  if (!Article) {
    return `Corrupt article: ${article}`;
  }
  return Article;
}

function getArticle(article: string) {
  switch (article) {
    case "collaboration":
      return <Collaboration />;
    case "nesting":
      return <Nesting />;
    case "slideshow":
      return <Slideshow />;
    case "game":
      return <Game />;
  }
}
