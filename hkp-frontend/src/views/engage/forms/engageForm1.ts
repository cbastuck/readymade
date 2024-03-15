import { FeedbackQuestion } from "../FeedbackForm";

export const feedbackQuestions: Array<FeedbackQuestion> = [
  {
    type: "reaction",
    question:
      "Everyone would build their own small, personal apps and services, assuming that it does not require an in-depth technical foundation and that they need to learn a new language first.",
    mode: "single",
    options: [
      "Yes, absolutely",
      "Yes, I would like to, but maybe that's just me",
      "Maybe, but certainly building needs to get a lot easier",
      "No chance, too much effort, got better things to do",
    ],
    direction: "column",
  },

  {
    options: [
      "No, not really",
      "Interested yes, but I consider myself less experienced",
      "I want to get better with computers so I can do more stuff",
      "Yeah, I use the computer for my own needs whenever I can",
      "Yes, I'm able to write code",
      "I have experience, but I'm becoming less interested",
      "I'm just here for the loot and fun",
    ],
    type: "answer",
    mode: "many",
    question:
      "Are you into tech stuff and have some hands-on experience with it?",
    direction: "column",
  },
];
