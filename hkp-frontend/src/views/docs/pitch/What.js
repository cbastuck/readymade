import Template, { BackButton } from "../../Template";

export default function What() {
  return (
    <Template title="What's the point" isRoot={true}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 20,
          fontSize: 16,
          fontFamily: "Roboto",
          letterSpacing: 1,
        }}
      >
        <div>
          Explore ideas to build logic and computational behavior with a
          different mindset than an engineering mindset. More playful and
          preferably using less code.
        </div>
        <div>
          Focus on ideas and prototypical solutions that provide insights and
          most important lead to follow-up questions. Iterate on aspects of
          centrality, connectivity, authority and scale. In particular
          acknowledge small and indvidual spaces, ie. solutions that matter to
          only a few of us, but maybe to problems relevant to most?{" "}
        </div>
        <div>
          The more we spread the ability to analyze and decompose patterns
          around us, even using technical terms, the more we set the odds for
          finding appropriate solutions, ideally before we need them.
        </div>
        <div>
          In this picture, this project can be understood as an imperfect and
          naive private endeavour. Sure, that is an excuse, but also a
          disclaimer to set expectations: you will hear three chords, not a
          symphony. This project focuses on exploration and little on delivery.
          It rather tells a story for the interested, one that sounds a bit
          unconventional, certainly comes unpredictable and hopefully leaves the
          reader more puzzled and curious than before.
        </div>
        <div>
          Even imperfect solutions can help formulating new questions and
          sometimes even identify underlying, hidden problems.
        </div>
        <div>
          Automation and digitalisation are on the agenda, and so should be
          upscaling the group of people finding the unknown problems and/or
          solutions. Or contributing to both of them being found, instead of
          upscaling the number of devices executing already known solutions to
          acknowledged problems that rank high in demand or return of invest.
        </div>
        <BackButton />
      </div>
    </Template>
  );
}
