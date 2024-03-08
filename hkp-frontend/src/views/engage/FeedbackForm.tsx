import Feedback, {
  FeedbackOptionsDirection,
  FeedbackQuestionMode,
  FeedbackType,
} from "./Feedback";

export type FeedbackQuestion = {
  type: FeedbackType;
  question: string;
  options: Array<string>;
  mode: FeedbackQuestionMode;
  direction?: FeedbackOptionsDirection;
};

type Props = {
  questions: Array<FeedbackQuestion>;
};

export default function FeedbackForm({ questions }: Props) {
  return (
    <>
      {questions.map(({ options, question, mode, type, direction }, idx) => (
        <Feedback
          key={`feedback-item-${idx}`}
          order={idx + 1}
          options={options}
          mode={mode}
          type={type}
          direction={direction}
          question={question}
        />
      ))}
    </>
  );
}
