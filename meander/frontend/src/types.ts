export type Remote = {
  port: number;
  url: string;
  name: string;
  color?: string;
  /** Other names the server answers to, beside `name`. */
  aliases?: string[];
};
