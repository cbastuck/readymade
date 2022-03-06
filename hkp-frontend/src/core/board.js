import {
  uniqueNamesGenerator,
  adjectives,
  animals,
} from "unique-names-generator";
const config = {
  dictionaries: [adjectives, animals],
  separator: "-",
  length: 2,
};

export function generateRandomName() {
  return uniqueNamesGenerator(config);
}
