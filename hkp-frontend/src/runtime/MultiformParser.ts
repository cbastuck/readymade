import TextDecoder from "./TextDecoderPolyfill";

const decoder = new TextDecoder();

function utf16leBufferToStr(buf: ArrayBuffer) {
  const arr: any = new Uint16Array(buf);
  return String.fromCharCode.apply(null, arr); // TODO not sure if this is correct
}

function utf8BufferToStr(buf: BufferSource): string {
  return decoder.decode(buf);
}

const CRLF = "\r\n";

export function parseResponse(
  arraybuf: ArrayBuffer | string
): MultipartsResult | Blob | string {
  if (typeof arraybuf === "string") {
    return arraybuf;
  }
  const view = new DataView(arraybuf);
  const boundaryLength = view.getUint32(0); // BE
  if (boundaryLength === 0) {
    // no multipart-form data
    const binary = view.getUint8(4) === "b".charCodeAt(0);
    if (binary) {
      return new Blob([arraybuf.slice(5)], {
        type: "application/octet-stream",
      });
    } else {
      const useUTF8 = true;
      return useUTF8
        ? utf8BufferToStr(arraybuf.slice(5))
        : utf16leBufferToStr(arraybuf.slice(5));
    }
  }
  // the reponse is a multipart-form
  const boundaryBuf = arraybuf.slice(4, boundaryLength + 4);
  const boundary = `--${utf8BufferToStr(boundaryBuf)}`;
  const body = arraybuf.slice(boundaryLength + 4);
  return parseMultipart(body, boundary);
}

function stringToCharCodes(str: string): Array<number> {
  return str.split("").map((c) => c.charCodeAt(0));
}

function findStringInView(
  searchString: string,
  view: Uint8Array,
  startIndex: number = 0
) {
  function finder(str: string, startIndex: number = 0) {
    const arr = stringToCharCodes(str);
    return function (_element: any, index: number, view: Uint8Array) {
      const n = arr.length - 1;
      if (index < n || index <= startIndex) {
        return false;
      }
      for (let i = n, j = 0; i >= 0; --i, ++j) {
        if (arr[i] !== view[index - j]) {
          return false;
        }
      }
      return true;
    };
  }
  const idx = view.findIndex(finder(searchString, startIndex));
  return idx === -1 ? -1 : idx + 1;
}

type Headers = { [key: string]: any };

function parsePartHeader(
  view: Uint8Array,
  verifyBoundary?: string
): { headers: Headers; finished: boolean; end: number } {
  const headers: Headers = {};
  for (let start = 0, end = 0; end !== -1; start = end) {
    end = findStringInView(CRLF, view, start);
    if (end !== -1) {
      const slice = view.slice(start, end);
      const line = utf8BufferToStr(slice);
      if (verifyBoundary && start === 0) {
        if (line === `${verifyBoundary}--\r\n`) {
          // end of multipart
          return { headers: {}, finished: true, end };
        }
        if (line !== `${verifyBoundary}\r\n`) {
          throw new Error(
            `Boundary does not match \n${stringToCharCodes(
              line
            )} vs. \n${stringToCharCodes(verifyBoundary)}`
          );
        }
      }
      const [key, value] = line.split(":").map((s) => s.trim());
      if (key !== undefined && value !== undefined) {
        headers[key.toLowerCase()] = value;
      }
    }
    if (end - start === CRLF.length) {
      return { headers, end, finished: false }; // header ends with empty CLCR
    }
  }
  throw new Error(`No ending CRLF when parsing multiform header found`);
}

function assureEqual(
  view: Uint8Array,
  start: number,
  end: number,
  expectedStr: string
) {
  const expectedChars = stringToCharCodes(expectedStr);
  for (let i = 0, n = end - start; i < n; ++i) {
    if (view[start + i] !== expectedChars[i]) {
      throw new Error(
        `Assertion failed: ${view[start + i]} vs. ${expectedChars[i]} at ${i}`
      );
    }
  }
}

type Part = {
  headers: Headers;
  payload: any;
  end: number;
  name: string;
};
function readPart(
  fullView: Uint8Array,
  boundary: string,
  startPos: number = 0
): Part | null {
  if (startPos >= fullView.length) {
    return null;
  }

  const view = fullView.slice(startPos);
  const {
    headers,
    end: headerEndPos,
    finished,
  } = parsePartHeader(view, boundary);
  if (finished) {
    return null;
  }
  const contentLengthHeader = headers && headers["content-length"];
  const contentLength = contentLengthHeader
    ? Number(contentLengthHeader)
    : undefined;
  if (contentLength === undefined) {
    throw new Error(
      "No content length in multipart - Searching for end-boundary not implemented"
    );
  }
  const payloadEndPos = headerEndPos + contentLength;
  const payload = view.slice(headerEndPos, payloadEndPos);
  assureEqual(view, payloadEndPos, payloadEndPos + 2, CRLF);

  const contentType = headers["content-type"];
  const isJSON = contentType && contentType === "application/json";

  const contentDisposition = headers["content-disposition"];
  const quotedPartName =
    contentDisposition && contentDisposition.split("name=")[1];
  return {
    headers,
    payload: isJSON ? JSON.parse(utf8BufferToStr(payload)) : payload,
    end: startPos + payloadEndPos + 2,
    name: quotedPartName && quotedPartName.substr(1, quotedPartName.length - 2), // remove quotes around name
  };
}

export type MultipartsResult = {
  [partName: string]: { headers: Headers; payload: any };
};

export function isMultipartsResult(obj: any): obj is MultipartsResult {
  return obj.json;
}

function parseMultipart(body: ArrayBuffer, boundary: string): MultipartsResult {
  const view = new Uint8Array(body);
  let part: Part | null = null;
  const parts: MultipartsResult = {};
  do {
    part = readPart(view, boundary, part?.end || 0);
    if (part) {
      parts[part.name] = {
        headers: part.headers,
        payload: part.payload,
      };
    }
  } while (part);
  return parts;
}
