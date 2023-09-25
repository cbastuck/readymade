export type DescriptionType =
  | "headline"
  | "check"
  | "link"
  | "vspace"
  | "qr"
  | "text";

export type BaseType = {
  type: DescriptionType;
};

export type HeadlineType = {
  type: DescriptionType;
  text: string;
};

export type CheckType = {
  type: DescriptionType;
  url: string;
  text: string;
};

export type LinkType = {
  type: DescriptionType;
  text: string;
  href: string;
};

export type VSpaceType = {
  type: DescriptionType;
  size: number | string;
};

export type QRCodeType = {
  type: DescriptionType;
  href: string;
  board: string;
};

export type TextType = {
  type: DescriptionType;
  value: string;
  alignment: "left" | "center" | "right";
};
