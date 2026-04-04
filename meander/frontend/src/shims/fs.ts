// Stub for Node.js `fs` module in browser builds.
// monaco-editor's TypeScript language service has a conditional fs.readFileSync
// code path; this prevents Vite from emitting the "externalized for browser
// compatibility" warning.
export const readFileSync = () => "";
export const existsSync = () => false;
export const readdirSync = () => [];
export default { readFileSync, existsSync, readdirSync };
