import Image from "../../../../components/layout/Image";
import Paragraph from "../../../../components/layout/Paragraph";
import Article from "../../../../components/layout/Article";
import Video from "../../../../components/layout/Video";
import Code from "../../../../components/layout/Code";

import nestingExampleBoard from "./1708860295675.jpeg";
import nestingExampleOuter from "./1708853605642.jpeg";
import nestingStackBoard from "./1708800429203.jpeg";
import nestingTagesschauBoard from "./1708800674450.jpeg";
import hero from "./1708869110895.jpeg";

export default function NestingBoards() {
  return (
    <Article
      title="Nesting Boards: Each Puzzle Piece, a Puzzle Itself"
      hero={hero}
      slug="nesting"
      date="25.2.2024"
    >
      <Paragraph headline="Motivation">
        Think of a big puzzle with lots of smaller pieces. Each piece crafted to
        fit together seamlessly. Now, zoom in - every seemingly simple piece is,
        in fact, a puzzle in its own right, like a mini-puzzle itself. It
        doesn't stop there. It's a cascade of nested puzzles. Exploration at any
        level reveals intricate details, turning what initially appears
        straightforward into a captivating tapestry of interconnected
        complexities.
      </Paragraph>
      <Paragraph>
        The concept isn't something novel; in fact, it surrounds our daily
        lives. Replace 'puzzle' with an informative web page, and the puzzle
        pieces become the articulate words within that page. Some words are
        links to other pages, providing additional information, further context
        or background. Referenced pages, in turn, contain links that enable
        further exploration into deeper layers. This intricacy defines the
        fundament of the World Wide Web.
      </Paragraph>
      <Paragraph>
        Functions in computer science share a similar nature. Operating on a set
        of input parameters, a function eventually generates an output or
        side-effect. The composition of these functions forms a new building
        block, echoing the puzzle analogy from above. The caller of the function
        need not comprehend how it achieves its purpose but rather understand
        what parameters to pass and what result to expect in return. Functions,
        as simple and powerful building blocks, are the inspiration behind the
        service BoardService, which aims to replicate this abstraction.
      </Paragraph>

      <Paragraph headline="Inception: The Board/Service Duality">
        First, a quick recap. Board, Runtime, and Service constitute the
        fundamental building blocks of Hookup. A Board is composed of multiple
        Runtimes, and each Runtime is made up of individual Services.{" "}
      </Paragraph>

      <Paragraph>
        The service BoardService embodies the recursive puzzle/puzzle-piece
        structure. Internally it embeds another referenced board. The service's
        inputs are directed to the first runtime of the nested board, and
        similarly, the result from the last runtime is passed to the output of
        the service. Thus, any board can be utilized as a service within another
        board.
      </Paragraph>

      <Paragraph>
        Here's a quick example to illustrate the basic concept: picture a simple
        board with one browser runtime. This runtime takes a JSON input, squares
        its x property, and returns an object that retains the squared value in
        the value property.
      </Paragraph>
      <Image
        src={nestingExampleBoard}
        alt="Example inner board for nesting boards"
        caption="1. Simple-Nesting board comprises a single runtime housing a Map service, which squares the 'x'-property and writes it as 'value'-property in the resulting object"
      />

      <Paragraph>
        Now inject some data at the input and observe the results at the output
      </Paragraph>
      <Image
        src={nestingExampleOuter}
        alt="Example outer board, hosting the inner board"
        caption="2. Concluding with an Injector service on the left and a Monitor service on the right side, providing basic Input/Output functionality"
      />

      <Paragraph headline="A real world example - Daily Digest (Part One)">
        That's a contrived example; now let's delve into a real-world use case
        of board nesting. Consider this scenario: you check several online
        sources every morning to stay informed about what matters to you.
        Wouldn't it be great if you could automate most of this task and have
        one site that collects the most important information from these
        resources, presenting them on a single page, like your daily morning
        digest?
      </Paragraph>

      <Paragraph>
        For example, envision a digest that includes recent news from
        tageschau.de, a selection of subreddits from reddit.com, the front-page
        headlines from news.ycombinator.com, and the upcoming departure time
        from your daily bus station in Berlin (BVG) leading to your workplace.
      </Paragraph>

      <Paragraph>
        Now, let's consolidate everything within a Stack service. Each news
        source is resolved in a dedicated board and nested within the Stack
        using Board-Services. You can build and test each board separately, and
        once you're satisfied, reference it from the outer board.
      </Paragraph>
      <Image
        src={nestingStackBoard}
        alt="Stacked board with four items"
        caption="1. Stack service that hosts four board-services each referencing another board"
      />
      <Image
        src={nestingTagesschauBoard}
        alt="One of the stacked board, the one retrieving tagesschau news"
        caption="2. Tagesschau board itself, which used as the first board-service of the stack in 1."
      />
      <Paragraph>
        The HTML selector service collects headlines and links from
        tagesschau.de, so the result of the first runtime is an array of type:
      </Paragraph>
      <Code>{`Array<{ title: string, link: string}>`}</Code>
      <Paragraph>
        The Array transform service then converts each array item into HTML
        nodes of the following form:
      </Paragraph>
      <Code>{`<div> <a href="[[link]]">[[title]]</a> </div>`}</Code>

      <Paragraph>
        The HTML service at the end renders the incoming HTML. It's important to
        note that this service has been disabled after building and testing the
        board in isolation. As rendering occurs in the outer board, the HTML
        service can be disabled in the end.
      </Paragraph>

      <Paragraph headline="Outlook: Adding Another Level (Part Two)">
        As a follow-up, let's envision another layer wrapping the Stack from
        Part One into an application. Picture a small interactive canvas that
        displays one news item at a time, providing the ability to swipe left
        for further processing and right if the article is considered irrelevant
        for the current purpose.
      </Paragraph>

      <Paragraph>
        Further processing could be as straightforward as downloading and saving
        articles for later reading or could involve more sophisticated actions,
        such as translating the articles, creating a concise summary, and
        generating an audio briefing, as showcased in a previous article.
      </Paragraph>

      <Paragraph>
        However, these are likely only the most apparent possibilities. In the
        mid-term, such setups could be utilised for fine-tuning Large Language
        Models to recommend news articles that align with your interests. This
        involves creating a board that automatically filters news items and
        generates the daily digest with minimal manual interaction, among other
        potential applications. While it is truly exciting, it is beyond the
        scope of this article and will be explored in a follow-up.
      </Paragraph>

      <Paragraph>
        Furthermore, the service topology within a runtime is currently limited
        to pipelines, giving priority to nesting over advanced graph topologies
        for its simplicity and elegance. Beyond basic pipelines, advanced
        arrangements quickly become "messy" and challenging to understand,
        particularly weeks or months later, unless "good" abstractions exist.
      </Paragraph>

      <Paragraph>
        The goal is to prevent the worst-case scenario of arbitrary service
        connections evolving into what was coined as Spaghetti-Code in classical
        imperative programming. However, the exploration of concepts
        transforming pipelines into graph structures through intuitive yet
        powerful abstractions will be the subject of a subsequent article. The
        approach is supposed to mirror the effect of data-flow structures as
        introduced by structured programming, providing an alternative to overly
        employed goto statements.
      </Paragraph>
      <Video
        anchor="video"
        caption="Demo of the nested news board"
        src="/assets/videos/NestingBoardsOverdubbedEnhanced social.mp4"
      />
    </Article>
  );
}
