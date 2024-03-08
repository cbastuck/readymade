import { FormField, FormGroup } from "semantic-ui-react";

export type FeedbackQuestionMode = "single" | "many";
export type FeedbackType = "reaction" | "answer";
export type FeedbackOptionsDirection = "row" | "column";

type Props = {
  order: number;
  options: string[];
  mode: FeedbackQuestionMode;
  type: FeedbackType;
  question: string;
  direction?: FeedbackOptionsDirection;
};

export default function Feedback({
  order,
  options,
  mode,
  type,
  direction = "row",
  question,
}: Props) {
  const padding = { margin: "0px 20px" };
  const headline =
    type === "reaction"
      ? `${order.toString()}. How would you react? `
      : `${order.toString()}. What would you say?`;
  return (
    <div style={{ marginTop: "5px" }}>
      <h1 style={{ fontSize: "14pt", padding: "10px 0px" }}>{headline}</h1>

      <div style={{ width: "80%", margin: "auto" }}>
        <blockquote
          style={{
            width: "100%",
            fontSize: 18,
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
          }}
          grouped
        >
          {mode === "single" &&
            options.map((opt) => (
              <FormField
                key={opt}
                style={padding}
                label={opt}
                control="input"
                type="radio"
                name="htmlRadios"
              />
            ))}
          {mode === "many" &&
            options.map((opt) => (
              <FormField
                key={opt}
                style={padding}
                label={opt}
                control="input"
                type="checkbox"
              />
            ))}
        </FormGroup>
      </div>
    </div>
  );
}
