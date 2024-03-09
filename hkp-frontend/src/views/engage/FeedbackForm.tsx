import Feedback, {
  FeedbackAnswer,
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

export type FeedbackFormAnswers = Record<number, FeedbackAnswer>;

type Props = {
  questions: Array<FeedbackQuestion>;
  onChange: (questionIdx: number, values: FeedbackAnswer) => void;
  answers: FeedbackFormAnswers;
};

export default function FeedbackForm({ questions, answers, onChange }: Props) {
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
          answers={answers[idx]}
          onChange={(answer: FeedbackAnswer) => onChange(idx, answer)}
        />
      ))}
    </>
  );
}
