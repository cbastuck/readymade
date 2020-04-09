const decoder = new TextDecoder();

function utf16leBufferToStr(buf) {
  return String.fromCharCode.apply(null, new Uint16Array(buf));
}

function utf8BufferToStr(buf) {
  return decoder.decode(buf);
}

export function parseResponse(arraybuf) {
  const view = new DataView(arraybuf);
  const boundaryLength = view.getUint32(0); // BE
  if (boundaryLength === 0) {
    const useUTF8 = true;
    return useUTF8 ? 
      utf8BufferToStr(arraybuf.slice(4)) : 
      utf16leBufferToStr(arraybuf.slice(4));
  }
  
  const boundaryBuf = arraybuf.slice(4, boundaryLength + 4);
  const boundary = utf8BufferToStr(boundaryBuf);
  const body = arraybuf.slice(boundaryLength + 5);
  return parseMultipart(body, boundary);
}

function findStringInView(searchString, view, startIndex=0) {
  function finder(str, startIndex=0) {
    const arr = str.split('').map(c => c.charCodeAt(0));
    return function(element, index, view){
      const n = arr.length - 1;
      if (index < n || index <= startIndex) {
        return false;
      }
      for (let i=n, j=0; i >= 0; --i, ++j) {
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

function parsePartHeader(view) {
  const headers = {};
  const CLCR = '\r\n';
  for (let start = 0, end = 0; end !== -1; start = end) {
    end = findStringInView(CLCR, view, start);
    if (end !== -1) { 
      const slice = view.slice(start, end);
      const line = utf8BufferToStr(slice);
      const [key, value] = line.split(':').map(s => s.trim());
      if (key !== undefined && value !== undefined) {
        headers[key] = value;
      }
    }
    if (end-start === CLCR.length) {
      return { headers, end }; // header ends with empty CLCR
    }
  }
}

function parseMultipart(body, boundary) { 
  const view = new Uint8Array(body);
  // read part
  // 1. read header 
  const { headers, end } = parsePartHeader(view) || {};
  const contentLength = Number(headers['content-length']);
  const payload = view.slice(end, end + contentLength)
  console.log('GOT headers', headers, end);
  console.log('GOt PAYLOD', utf8BufferToStr(payload))

  const part2Start = end + contentLength + 2;
  const part2 = view.slice(part2Start);
  const { headers: h2, end: e2 } = parsePartHeader(part2);
  console.log('GOT headers2', h2, part2Start, e2);
  console.log('GOt PAYLOD2', utf8BufferToStr(part2))
  
}