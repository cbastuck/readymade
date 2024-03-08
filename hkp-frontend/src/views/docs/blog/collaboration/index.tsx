import Article from "../../../../components/layout/Article";
import Image from "../../../../components/layout/Image";

import Paragraph from "../../../../components/layout/Paragraph";
import Video from "../../../../components/layout/Video";

import hero from "./1702039227041.png";
import summarizeNewsBoard from "./1702043655732.jpeg";

export default function HumanMachineCollaboration() {
  return (
    <Article
      slug="collaboration"
      title="Human-machine collaboration and Determinism"
      hero={hero}
      caption="Dall.E: “minimal pencil drawing consisting of few strokes where a hand reaches out to an electric circuit and the fingers blend with the circuit (+Fx)"
      date="8.12.2023"
    >
      <Paragraph>
        My prior articles regarding Hookup have focused on creating logical
        sequences through service chains and their interconnections. The
        emphasis was on services that provide semantically meaningful outputs
        based on the given inputs. The same input invariably produces the same
        output, adhering to a deterministic model. This deterministic framework
        forms the foundation of software engineering, providing precise control:
        the human thinks - the machine executes.
      </Paragraph>

      <Paragraph>
        Limitations become visible as machine capabilities advance, and their
        capacity to emulate human-like interactions and reasoning based on human
        context becomes increasingly sophisticated. Moreover, large language
        models mark a significant shift: natural language becomes a source for
        computational execution. Inevitably, this adds a level of
        non-determinism into the process. Probably similar to how diverse
        humans, each influenced by personal values, context, and history, would
        produce different outcomes while executing the same task.
      </Paragraph>

      <Paragraph>
        Recognising and embracing this concept transforms the dynamics from
        one-sided human-machine interactions to collaborative efforts between
        humans and machines. Establishing a back and forth exchange between
        computational outputs and human inputs and vice-versa, leading to a more
        cooperative relationship. We can see one form of such collaboration in
        chat-bot-based communications, showing this bidirectional interaction.
      </Paragraph>

      <Paragraph>
        The subsequent example illustrates an additional facet of collaboration
        between the human-guided execution model and the generative ability of
        machines. This converges into a nuanced, non-deterministic yet pertinent
        output.
      </Paragraph>

      <Paragraph>
        Primarily, this article aims to explore the optimistic potential of AI.
        Certainly, scenarios where AI could potentially pose a threat to
        humanity should be taken seriously and addressed. Still, it is equally
        relevant to consider scenarios where AI can assist humanity in
        overcoming existential challenges that we ourselves bear responsibility
        for. The Hookup model, can be a tool for human-machine collaboration,
        helping explore combinations of deterministic and non-deterministic
        behaviours.
      </Paragraph>
      <h2>Example</h2>
      <Paragraph>
        The following board consists of two runtimes: Go and Chrome
      </Paragraph>

      <Image
        src={summarizeNewsBoard}
        alt="Board creating the summary using two runtimes"
        caption="Two runtimes transform the following german news article into a translated audible summary "
      />
      <Paragraph>
        Go is the name of a remote runtime that is designed to retrieve a news
        article from a German public broadcast service. It extracts text
        paragraphs from the article using a specific method (CSS selector), then
        processes this information into a structured format called JSON. This
        structured output, containing a list of the article's paragraphs, is fed
        into the GPT module. Internally, this module utilizes OpenAI's GPT3.5
        Turbo model to perform the task.
      </Paragraph>

      <Paragraph>
        Chrome is the default name of a runtime running in that browser. It
        monitors the produced summary from the Go runtime. This summary is then
        formatted into a request for a local Text To Speech service.
        Subsequently, the generated audio is played through a media player
        service.
      </Paragraph>

      <Paragraph>
        The interesting service within the scope of this article is the GPT
        service located at the top-right of the Chrome runtime. It receives
        execution instructions in natural language, introducing
        non-deterministic behavior into the process.
      </Paragraph>

      <Paragraph>
        The initial step involves the board-user describing the formats of the
        incoming data and the expected output. The task definition, combined
        with these specifications and the input data, collectively forms the
        prompt for the ChatGPT request.
      </Paragraph>

      <Paragraph>
        The temperature for this task is configured to its minimum value to
        ensure highly deterministic output. Running the process multiple times
        is expected to yield roughly consistent outcomes.
      </Paragraph>

      <Paragraph>
        Check out the video:
        <Video
          caption="Creating an audio summary of a news article"
          src="/assets/videos/3-read-tagesschau-article-summary.mp4"
        />
      </Paragraph>

      <Paragraph>
        The upcoming article will explore advanced building blocks, focusing on
        encapsulating an entire board, comprising various runtimes and services,
        into a single service. This approach enables the creation of more
        complex and reusable building blocks.
      </Paragraph>
    </Article>
  );
}
