import {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals,
} from "unique-names-generator";
const config = {
  dictionaries: [adjectives, colors, animals],
  separator: "-",
  length: 3,
};

export function generateRandomName() {
  return uniqueNamesGenerator(config);
}
