import CheckboxGroup from "hkp-frontend/src/ui-components/CheckboxGroup";
import RadioGroup from "hkp-frontend/src/ui-components/RadioGroup";

export type FeedbackQuestionMode = "single" | "many";
export type FeedbackType = "reaction" | "answer";
export type FeedbackOptionsDirection = "row" | "column";

export type FeedbackAnswer = Record<number, boolean>;

type Props = {
  order: number;
  options: string[];
  mode: FeedbackQuestionMode;
  type: FeedbackType;
  question: string;
  answers: FeedbackAnswer;
  direction?: FeedbackOptionsDirection;
  onChange: (answer: FeedbackAnswer) => void;
};

export default function Feedback({
  order,
  options,
  mode,
  type,
  question,
  answers,
  onChange,
}: Props) {
  const headline =
    type === "reaction"
      ? `${order.toString()}. How would you react? `
      : `${order.toString()}. What would you answer?`;

  const currentAnswerValues = Object.keys(answers).flatMap((answerIdx) =>
    answers[Number(answerIdx)] ? [options[Number(answerIdx)]] : []
  );

  return (
    <div style={{ marginTop: "5px" }}>
      <h1 style={{ fontSize: "14pt", padding: "10px 0px" }}>{headline}</h1>

      <div style={{ width: "80%", margin: "auto" }}>
        <blockquote
          style={{
            width: "100%",
            fontSize: "14pt",
            textAlign: "center",
          }}
        >
          {question}
        </blockquote>
        <div className="my-2">
          {mode === "single" && (
            <RadioGroup
              id={question}
              vertical
              title="Select a single answer"
              options={options}
              value={currentAnswerValues[0] || undefined}
              onChange={(value) => {
                onChange({
                  [options.findIndex((a) => a === value)]: true,
                });
              }}
            />
          )}

          {mode === "many" && (
            <CheckboxGroup
              id={question}
              title="Multiple answers possible"
              options={options}
              values={currentAnswerValues}
              onChange={(value: string, checked: boolean) => {
                onChange({
                  ...answers,
                  [options.findIndex((a) => a === value)]: checked,
                });
              }}
              vertical
            />
          )}
        </div>
      </div>
    </div>
  );
}
