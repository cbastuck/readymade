import { useCallback, useState } from "react";

import FeedbackForm, { FeedbackFormAnswers } from "./FeedbackForm";
import { PersonalData } from "./Personals";

import { FeedbackAnswer } from "./Feedback";

import Article from "../../components/layout/Article";
import Motivation from "./Motivation";
import PersonalForm from "./PersonalForm";
import { convertAnswers, postAnswers } from "./actions";

import { feedbackQuestions } from "./forms/engageForm1";
import Button from "hkp-frontend/src/ui-components/Button";

type Props = {
  withTemplate?: boolean;
};
export default function Engage({ withTemplate = true }: Props) {
  const [showPersonals, setShowPersonals] = useState(false);
  const [tcAgreed, setTcAgreed] = useState(false);
  const [personals, setPersonals] = useState<PersonalData>({
    firstName: "",
    email: "",
  });
  const [answers, setAnswers] = useState<FeedbackFormAnswers>(
    feedbackQuestions.reduce((a, _, idx) => ({ ...a, [idx]: {} }), {})
  );

  const [submittedStatus, setSubmitStatus] = useState<
    boolean | string | undefined
  >(undefined);

  const handleSubmit = useCallback(async () => {
    const answerText = convertAnswers(feedbackQuestions, answers);
    const payload: any = tcAgreed
      ? { answers: answerText, personals }
      : { answers: answerText };

    try {
      if (await postAnswers(payload)) {
        setSubmitStatus(true);
      }
    } catch (err: any) {
      setSubmitStatus(err.message);
    }
  }, [tcAgreed, personals, answers]);

  const onShowPersonals = useCallback(() => {
    if (showPersonals) {
      // personal information visible
      setTcAgreed(false);
      setShowPersonals(false);
    } else {
      if (submittedStatus) {
        setSubmitStatus(undefined);
      }
      setShowPersonals(true);
    }
  }, [showPersonals, submittedStatus]);

  const onChangeAnswer = useCallback(
    (questionIdx: number, values: FeedbackAnswer) =>
      setAnswers((answers) => ({
        ...answers,
        [questionIdx]: values,
      })),
    []
  );

  const submitText = showPersonals
    ? "Submit with personal data"
    : "Submit anonymously";

  const statusText =
    submittedStatus === true
      ? "Submitted successfully"
      : `Try again (${submittedStatus})`;

  const submitButtonText = submittedStatus ? statusText : submitText;

  return (
    <Article title="What do you think?" width="60%" withTemplate={withTemplate}>
      <div className="text-md" style={{ width: "100%", textAlign: "right" }}>
        15.3.2024
      </div>
      <Motivation />

      <form onSubmit={handleSubmit}>
        <FeedbackForm
          questions={feedbackQuestions}
          answers={answers}
          onChange={onChangeAnswer}
        />
        <div style={{ margin: "30px" }} />

        <PersonalForm
          onToggleVisibility={onShowPersonals}
          isVisible={showPersonals}
          tcAgreed={tcAgreed}
          personals={personals}
          setTcAgreed={setTcAgreed}
          setPersonals={setPersonals}
        />
        <div
          style={{
            width: "100%",
            margin: "10px auto",
            marginBottom: "100px",
          }}
        >
          <Button
            className="text-base tracking-widest"
            type="submit"
            style={{
              width: "100%",
              height: "50px",
              color: "white",
              backgroundColor: "#1e70bf",
            }}
            disabled={submittedStatus === true || (showPersonals && !tcAgreed)}
          >
            {submitButtonText}
          </Button>
          {submittedStatus && <div>{}</div>}
        </div>
      </form>
    </Article>
  );
}
