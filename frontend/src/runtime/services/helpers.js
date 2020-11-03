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
