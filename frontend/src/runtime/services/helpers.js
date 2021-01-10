export function toArrayBuffer(blobOrFile) {
  if (blobOrFile.arrayBuffer) {
    return blobOrFile.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    try {
      fr.onload = () => resolve(fr.result);
      fr.readAsArrayBuffer(blobOrFile);
    } catch(err) {
      reject(err);
    }
  });
}

export function filterPrivateMembers(service) {
  return service && Object.keys(service).reduce(
    (res, cur) =>
      (cur[0] === '_' || cur === 'app') ?
        res :
        { ...res, [cur]: service[cur] },
    {}
  );
}