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

function parseMultipart(body, boundary) {
  function pattern(arr, startIdx=0) {
    return function (element, index, view) {
      for (let i=0; i<arr.length; ++i) {
        if (arr[i] !== view[index + i + startIdx]) {
          return false;
        }
      }
      return true;
    }
  }
  const view = new Uint8Array(body);
  /*const arr = boundary.split('').map(c => c.charCodeAt(0));
  for (let offset = 0, pos; pos !== -1; ++offset) {
    pos = view.findIndex(pattern(arr, offset));
    console.log('FOUND', pos)
  }*/
  
  
  console.log('Parsing Multipart', utf8BufferToStr(body));
}