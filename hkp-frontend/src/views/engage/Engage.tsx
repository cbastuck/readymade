import { useCallback, useState } from "react";
import { Form, Divider } from "semantic-ui-react";

import Template from "../Template";
import FeedbackForm, {
  FeedbackFormAnswers,
  FeedbackQuestion,
} from "./FeedbackForm";
import { PersonalData } from "./Personals";
import Button from "../../components/shared/Button";
import Participation from "./Participation";
import { FeedbackAnswer } from "./Feedback";

const feedbackQuestions: Array<FeedbackQuestion> = [
  {
    type: "reaction",
    question:
      "Everyone will build their own personal apps and services  - assuming it would not require an in-depth technical foundation and learning a new language first",
    mode: "single",
    options: [
      "Yes, rather sooner than later",
      "Maybe, but certainly not within the next few years",
      "No way, too much effort, and I have better things to do",
    ],
    direction: "column",
  },

  {
    options: [
      "No, not really",
      "Yes, I use the computer for my own needs where possible",
      "Yes, I'm able to write code",
      "Interested yes, but I consider myself less experienced",
      "I would like to be able to do more using computers",
      "I'm experienced, but I'm getting less interested",
      "I'm just here for the loot and fun",
    ],
    type: "answer",
    mode: "many",
    question: "Are you technically interested and experienced?",
    direction: "column",
  },
];

export default function Engage() {
  const [showPersonals, setShowPersonals] = useState(false);
  const [tcAgreed, setTcAgreed] = useState(false);
  const [personals, setPersonals] = useState<PersonalData>({
    firstName: "",
    email: "",
  });
  const [answers, setAnswers] = useState<FeedbackFormAnswers>(
    feedbackQuestions.reduce((a, _, idx) => ({ ...a, [idx]: {} }), {})
  );

  const handleSubmit = useCallback(() => {
    if (tcAgreed) {
      console.log("Submitting", tcAgreed, personals.firstName, personals.email);
    } else {
      console.log("Submitting anonymously");
      const payload = convertAnswers(answers);
      console.log("", answers, payload);
      fetch(
        "http://localhost:5555/runtime/69f0395a-2012-4035-817d-369fe56df227/service/43140ffb-b516-431f-b34d-df09487d07d7/in",
        { method: "POST", body: JSON.stringify(payload) }
      )
        .then((x) => x.json())
        .then((j) => console.log("-->", j));
    }
  }, [tcAgreed, personals, answers]);

  const onShowPersonals = useCallback(
    () => setShowPersonals(!showPersonals),
    [showPersonals]
  );

  const onChangeAnswer = useCallback(
    (questionIdx: number, values: FeedbackAnswer) =>
      setAnswers((answers) => ({
        ...answers,
        [questionIdx]: values,
      })),
    []
  );

  console.log("RENDEIRNG ANSWERS", answers);

  return (
    <Template title="What do you think?" isRoot={true}>
      <Form onSubmit={handleSubmit}>
        <FeedbackForm
          questions={feedbackQuestions}
          answers={answers}
          onChange={onChangeAnswer}
        />
        <Divider style={{ margin: "30px" }} />

        <div style={{ margin: "10px 0px" }}>
          <button
            onClick={onShowPersonals}
            className="hkp-fnt-family"
            style={{
              padding: 0,
              backgroundColor: "transparent",
              border: "none",
              color: "rgb(66, 132, 196)",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {showPersonals
              ? "No, does not look it's for me, remove that block again!"
              : "I would like to engage more"}
          </button>
        </div>
        <div
          style={{
            height: "100%",
            maxHeight: showPersonals ? 1000 : 0,
            overflow: "hidden",
            opacity: showPersonals ? 1 : 0,
            transition: "max-height 1.5s, opacity 0.3s",
          }}
        >
          <Participation
            tcAgreed={tcAgreed}
            personals={personals}
            onPersonalsChanged={setPersonals}
            onTcChanged={setTcAgreed}
          />
        </div>
        <div
          style={{
            margin: "10px 0px",
          }}
        >
          <Button
            type="submit"
            style={{ width: "100%", height: "50px" }}
            disabled={showPersonals && !tcAgreed}
          >
            {showPersonals ? "Submit with personal data" : "Submit anonymously"}
          </Button>
        </div>
      </Form>
    </Template>
  );
}

function convertAnswers(
  answers: FeedbackFormAnswers
): Record<string, Array<string>> {
  return Object.keys(answers).reduce((all, _, idx) => {
    return {
      ...all,
      [feedbackQuestions[idx].question]: Object.keys(answers[idx]).reduce<
        Array<string>
      >((fall, cur) => {
        const fidx = Number(cur);
        if (!answers[idx][fidx]) {
          return fall;
        }
        return [...fall, feedbackQuestions[idx].options[fidx]];
      }, []),
    };
  }, {});
}
