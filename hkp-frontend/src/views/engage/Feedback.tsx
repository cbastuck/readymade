import { FormField, FormGroup } from "semantic-ui-react";

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
  direction = "row",
  question,
  answers,
  onChange,
}: Props) {
  const padding = { margin: "0px 20px" };
  const headline =
    type === "reaction"
      ? `${order.toString()}. How would you react? `
      : `${order.toString()}. What would you answer?`;

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
        {mode === "many" && (
          <div style={{ width: "80%", textAlign: "right" }}>
            (multiple answers possible)
          </div>
        )}
        <FormGroup
          style={{
            display: "flex",
            flexDirection: direction,
            padding: "5px 20px",
            fontSize: "12pt",
          }}
          grouped
        >
          {mode === "single" &&
            options.map((opt, idx) => (
              <FormField
                key={opt}
                style={padding}
                label={opt}
                control="input"
                type="radio"
                name="htmlRadios"
                onChange={(ev: any) => onChange({ [idx]: ev.target.checked })}
                checked={answers[idx] || false}
              />
            ))}
          {mode === "many" &&
            options.map((opt, idx) => (
              <FormField
                key={opt}
                style={padding}
                label={opt}
                control="input"
                type="checkbox"
                onChange={(ev: any) =>
                  onChange({ ...answers, [idx]: ev.target.checked })
                }
                checked={answers[idx] || false}
              />
            ))}
        </FormGroup>
      </div>
    </div>
  );
}
