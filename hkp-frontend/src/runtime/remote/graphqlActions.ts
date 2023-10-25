import {
  RuntimeClass,
  RuntimeDescriptor,
  ServiceClass,
  ServiceDescriptor,
  ServiceRegistry,
} from "../../types";

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

export async function createRuntime(
  desc: RuntimeClass
): Promise<(RuntimeDescriptor & RegistryProp) | null> {
  const url = `${desc.url}/query`;
  const payload = `mutation makeFreeRuntime {
      createRuntime(input: {name: "${desc.name}"}) {
        id
        name
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

export async function restoreRuntime(
  runtime: RuntimeDescriptor,
  services: Array<ServiceDescriptor>
) {
  const url = `${runtime.url}/query`;
  const payload = `mutation restoreFreeRuntime {
      restoreRuntime(input: {runtimeId: "${runtime.id}", runtimeName: "${
    runtime.name
  }", services: [
        ${services.map(
          ({ serviceId, serviceName, uuid }) =>
            `{instanceId: "${uuid}", serviceId: "${serviceId}", serviceName: "${serviceName}"}`
        )}
      ] }) {
        id
        name
        registry {
          serviceName
          serviceId
        }
        services {
          instanceId
          serviceId
          serviceName
        }
      }
    }`;
  const result = await processQuery(url, payload);

  return result;
}

export async function createRuntimeService(
  runtime: RuntimeDescriptor,
  service: ServiceClass
): Promise<ServiceDescriptor | null> {
  const url = `${runtime.url}/query`;
  const payload = `query addRuntimeService {
    runtimeById(runtimeId: "${runtime.id}") {
      createService(
        input: { uri: "${service.serviceId}", serviceName: "${service.serviceName}" }
      ) { 
        instanceId
        serviceName
        serviceId
      }
    }
  }`;
  const result = await processQuery(url, payload);
  if (!result) {
    return null;
  }

  const createServiceResult = result.data?.runtimeById?.createService;
  if (!createServiceResult) {
    return null;
  }
  const { instanceId, ...svc } = createServiceResult;
  return { ...svc, uuid: createServiceResult.instanceId };
}
