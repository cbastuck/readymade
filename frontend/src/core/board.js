import { generate } from 'unique-names-generator';

export function generateRandomName() {
  return generate('-').split('-').slice(1).join('-');
}