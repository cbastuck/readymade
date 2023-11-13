import {
  InstanceId,
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
        input: { serviceId: "${service.serviceId}", serviceName: "${service.serviceName}" }
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

export async function removeRuntimeService(
  runtime: RuntimeDescriptor,
  service: InstanceId
): Promise<Array<ServiceDescriptor> | null> {
  const url = `${runtime.url}/query`;
  const payload = `query removeRuntimeService {
    runtimeById(runtimeId: "${runtime.id}") {
      removeService(
        input: { instanceId: "${service.uuid}" }
      ) { 
          instanceId
          serviceId
          serviceName
      }
    }
  }`;
  const result = await processQuery(url, payload);
  if (!result) {
    return null;
  }
  return result.data?.runtimeById?.removeService;
}

export async function getRuntimeServiceConfig(
  runtime: RuntimeDescriptor,
  service: InstanceId
): Promise<any | null> {
  const url = `${runtime.url}/query`;
  const payload = `query getServiceConfig {
    runtimeById(runtimeId: "${runtime.id}") {
      serviceById(instanceId: "${service.uuid}") {
        config
      }
    }
  }`;
  const result = await processQuery(url, payload);
  if (!result) {
    return null;
  }

  const config = result.data?.runtimeById?.serviceById?.config;
  return config ? JSON.parse(config) : null;
}

export async function configureService(
  runtime: RuntimeDescriptor,
  service: InstanceId,
  config: object
) {
  const url = `${runtime.url}/query`;
  const stringifiedConfig = JSON.stringify(config);
  const payload = `query setServiceConfig {
    runtimeById(runtimeId: "${runtime.id}") {
      serviceById(instanceId: "${service.uuid}") {
        configure(input: { config: ${JSON.stringify(stringifiedConfig)} })
      }
    }
  }`;
  const result = await processQuery(url, payload);
  if (!result) {
    return null;
  }

  const resultConfig = result.data.runtimeById?.serviceById?.configure;
  return resultConfig ? JSON.parse(resultConfig) : null;
}

export async function processRuntime(
  runtime: RuntimeDescriptor,
  params: any,
  service: InstanceId | null
) {
  const url = `${runtime.url}/query`;
  const serviceInput = service
    ? `instanceId: "${service.uuid}"`
    : "instanceId: null";
  const payload = `query processRuntime {
    runtimeById(runtimeId: "${runtime.id}") {
      process(
        input: { 
          params: ${JSON.stringify(params)}, 
          ${serviceInput}
        }
      ) { id }
    }
  }`;
  const result = await processQuery(url, payload);
  if (!result) {
    return null;
  }

  return result.data.runtimeById?.process;
}

export async function getRuntimeOutputUrl(runtime: RuntimeDescriptor) {
  const url = `${runtime.url}/query`;
  const payload = `query getRuntimeOutputUrl {
    runtimeById(runtimeId: "${runtime.id}") {
      outputUrl
    }
  }`;
  const result = await processQuery(url, payload);
  if (!result) {
    return null;
  }

  return result.data?.runtimeById?.outputUrl;
}
