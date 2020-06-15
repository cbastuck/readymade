export default async function serializeObject(body) {
  if (!body) {
    return {
      contentType: undefined,
      body: undefined,
    };
  }
  
  if (body instanceof Blob) {
    return {
      contentType: body.type,
      body: await new Response(body).arrayBuffer(),
    };
  }

  const firstLevelBlobs = Object.keys(body).filter(key => body[key] instanceof Blob);
  if (firstLevelBlobs.length === 0) {
    return { 
      contentType: 'application/json',
      body: JSON.stringify(body),
    };
  }

  const createBlobKey = key => `+binary-data-@${key}`;
  const formData = new FormData();
  formData.append(
    'json', 
    JSON.stringify({ 
      ...body,
      ...firstLevelBlobs.reduce((acc, key) => 
        ({ ...acc, [key]: createBlobKey(key) }),
        {},
      )
    })
  );
  firstLevelBlobs.forEach(key => {
    const blobKey = createBlobKey(key);
    formData.append(blobKey, body[key], blobKey);
  });

  return {
    contentType: 'multipart/form-data', // by browser with boundary 'multipart/form-data',
    body: formData,
  }
}
