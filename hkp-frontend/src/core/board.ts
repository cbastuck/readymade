import { uniqueNamesGenerator, Config } from "unique-names-generator";
import { moods, objects } from "./boardNames";

const config: Config = {
  dictionaries: [moods, objects],
  separator: "-",
  length: 2,
  style: "capital",
};

export function generateRandomName(): string {
  return uniqueNamesGenerator(config);
}
