import * as td from "fastestsmallesttextencoderdecoder";

export default typeof TextDecoder === "undefined"
  ? td.TextDecoder
  : TextDecoder;
