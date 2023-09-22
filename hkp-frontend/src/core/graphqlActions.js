export async function createFreeRuntime(desc) {
  const url = `${desc.url}/query`;
  const payload = {
    query: `mutation makeFreeRuntime {
      createRuntime(input: {name: "FreeRuntime"}) {
        id
        name
      }
    }`,
  };
  const res = await fetch(url, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json" },
  });

  if (!res.ok || res.status !== 200) {
    return null;
  }

  const result = await res.json();
  const {
    data: { createRuntime },
  } = result;

  return createRuntime;
}

export async function getRuntimeRegistry(rt) {
  const url = `${rt.url}/query`;
  const payload = {
    query: `mutation makeFreeRuntime {
      createRuntime(input: {name: "FreeRuntime"}) {
        id
        name
      }
    }`,
  };
}
