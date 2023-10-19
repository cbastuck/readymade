import {
  RuntimeClass,
  RuntimeDescriptor,
  ServiceDescriptor,
  ServiceRegistry,
} from "../types";

export type ServicesProp = {
  services: Array<ServiceDescriptor>;
};

export type RegistryProp = {
  registry: ServiceRegistry;
};

async function processQuery(url: string, query: string) {
  const res = await fetch(url, {
    method: "POST",
    body: JSON.stringify({
      query,
    }),
    headers: { "content-type": "application/json" },
  });

  if (!res.ok || res.status !== 200) {
    return null;
  }

  return res.json();
}

export async function queryFreeRuntime(
  rt: RuntimeDescriptor
): Promise<(RuntimeDescriptor & RegistryProp & ServicesProp) | null> {
  const url = `${rt.url}/query`;
  // TODO: resolve single runtime by ID not ALL
  const payload = `mutation allRuntimes { 
    runtimes{
      id
      name
      registry {
        serviceId
        serviceName
      }
      services {
        id
        name
        uri
      }
    }
  }`;
  const result = await processQuery(url, payload);
  if (!result) {
    return null;
  }

  return (
    result.data?.runtimes.find((x: RuntimeDescriptor) => x.id === rt.id) || null
  );
}

export async function createFreeRuntime(
  desc: RuntimeClass
): Promise<(RuntimeDescriptor & RegistryProp) | null> {
  const url = `${desc.url}/query`;
  const payload = `mutation makeFreeRuntime {
      createRuntime(input: {name: "${desc.name}"}) {
        id
        name,
        registry {
          serviceName
          serviceId
        }
      }
    }`;
  const result = await processQuery(url, payload);
  if (!result) {
    return null;
  }

  return result.data?.createRuntime || null;
}
