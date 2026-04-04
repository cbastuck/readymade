// monaco-editor 0.55+ uses package exports that TypeScript/bundler moduleResolution
// cannot resolve for deep ESM subpaths. Re-export types from the package root.
declare module "monaco-editor/esm/vs/editor/editor.api" {
  export * from "monaco-editor";
}
declare module "monaco-editor/esm/vs/language/json/monaco.contribution" {}
declare module "monaco-editor/esm/vs/language/typescript/monaco.contribution" {}

// React 19 removed the global JSX namespace injection.
// This shim restores it so files using bare `JSX.Element` keep working.
declare namespace JSX {
  type Element = import("react").JSX.Element;
  type ElementClass = import("react").JSX.ElementClass;
  type ElementAttributesProperty = import("react").JSX.ElementAttributesProperty;
  type ElementChildrenAttribute = import("react").JSX.ElementChildrenAttribute;
  type LibraryManagedAttributes<C, P> = import("react").JSX.LibraryManagedAttributes<C, P>;
  type IntrinsicAttributes = import("react").JSX.IntrinsicAttributes;
  type IntrinsicClassAttributes<T> = import("react").JSX.IntrinsicClassAttributes<T>;
  type IntrinsicElements = import("react").JSX.IntrinsicElements;
}
