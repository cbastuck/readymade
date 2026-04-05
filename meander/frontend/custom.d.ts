/// <reference types="react" />

declare module "*.svg?react" {
  const content: React.FunctionComponent<React.SVGAttributes<SVGElement>>;
  export default content;
}

// Some shared hkp-frontend sources still type props as JSX.Element.
// Provide an ambient JSX namespace bridge for this workspace build.
declare namespace JSX {
  type Element = React.JSX.Element;
  interface IntrinsicElements extends React.JSX.IntrinsicElements {}
  interface IntrinsicAttributes extends React.JSX.IntrinsicAttributes {}
}

declare module "monaco-editor/esm/vs/editor/editor.api" {
  export * from "monaco-editor";
  import * as monaco from "monaco-editor";
  export default monaco;
}

declare module "monaco-editor/esm/vs/language/json/monaco.contribution";
declare module "monaco-editor/esm/vs/language/typescript/monaco.contribution";
