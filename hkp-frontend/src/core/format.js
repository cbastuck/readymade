export async function serializeObject(body) {
  if (!body) {
    return {
      contentType: undefined,
      body: undefined,
    };
  }

  if (typeof body === "string") {
    return {
      contentType: "text/plain",
      body,
    };
  }

  if (body instanceof Blob) {
    return {
      contentType: body.type,
      body: await new Response(body).arrayBuffer(),
    };
  }

  const firstLevelBlobs = Object.keys(body).filter(
    (key) => body[key] instanceof Blob
  );
  if (firstLevelBlobs.length === 0) {
    return {
      contentType: "application/json",
      body: JSON.stringify(body),
    };
  }

  const createBlobKey = (key) => `+binary-data-@${key}`;
  const formData = new FormData();
  formData.append(
    "json",
    JSON.stringify({
      ...body,
      ...firstLevelBlobs.reduce(
        (acc, key) => ({ ...acc, [key]: createBlobKey(key) }),
        {}
      ),
    })
  );
  firstLevelBlobs.forEach((key) => {
    const blobKey = createBlobKey(key);
    formData.append(blobKey, body[key], blobKey);
  });

  return {
    contentType: "multipart/form-data", // by browser with boundary 'multipart/form-data',
    body: formData,
  };
}

export async function serializeWebsocketBuffer(data, passedHeaders = {}) {
  const { body: serialisedBody, contentType } = await serializeObject(data);
  const binaryBody =
    serialisedBody instanceof ArrayBuffer
      ? serialisedBody
      : await new Response(serialisedBody).arrayBuffer();

  const headers = {
    ...passedHeaders,
    "content-type": contentType,
  };

  if (contentType === "multipart/form-data") {
    const uint8Body = new Uint8Array(binaryBody);
    const td = new TextDecoder("utf-8");
    // read boundary from the serialized body, but cut the first two hyphens
    // as they don't appear in the boundary defintion
    const boundary = td.decode(binaryBody.slice(2, uint8Body.indexOf(13)));
    headers["content-type"] += `;boundary=${boundary}`;
  }

  const encoder = new TextEncoder();
  const binaryHeaders = encoder.encode(JSON.stringify(headers) + "\n\n");
  const buffer = new ArrayBuffer(binaryHeaders.length + binaryBody.byteLength);
  const dst = new Uint8Array(buffer);
  dst.set(binaryHeaders);
  dst.set(new Uint8Array(binaryBody), binaryHeaders.length);
  return buffer;
}
