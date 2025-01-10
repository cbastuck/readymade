import { FeedbackFormAnswers, FeedbackQuestion } from "./FeedbackForm";

const engageBackendBoard =
  //"http://localhost:5555/runtime/hkp-engage/service/ingress/in";
  "https://gort.hookup.to/runtime/hkp-engage/service/ingress/in";

type AnswerPayload = Record<string, Array<string>>;

export async function postAnswers(payload: AnswerPayload): Promise<true> {
  try {
    const res = await fetch(engageBackendBoard, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "content-type": "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(res.statusText);
    }
  } catch (err: any) {
    console.error("Failed to post answers", err);
    throw err;
  }
  return true;
}

export function convertAnswers(
  feedbackQuestions: Array<FeedbackQuestion>,
  answers: FeedbackFormAnswers
): Record<string, Array<string>> {
  return Object.keys(answers).reduce((all, _, idx) => {
    const currentAnswers = Object.keys(answers[idx]);
    if (currentAnswers.length === 0) {
      return all;
    }
    return {
      ...all,
      [feedbackQuestions[idx].question]: currentAnswers.reduce<Array<string>>(
        (fall, cur) => {
          const fidx = Number(cur);
          if (!answers[idx][fidx]) {
            return fall;
          }
          return [...fall, feedbackQuestions[idx].options[fidx]];
        },
        []
      ),
    };
  }, {});
}
