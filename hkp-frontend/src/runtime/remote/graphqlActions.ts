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

function reportGQLError(err?: any) {
  throw new Error(err ? JSON.stringify(err) : "unspecified GQL request error");
}

async function processQuery(url: string, query: string) {
  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify({
      query,
    }),
    headers: { "content-type": "application/json" },
  });

  if (!response.ok || response.status !== 200) {
    return reportGQLError();
  }

  const result = await response.json();
  if (result.errors) {
    return reportGQLError(result.errors);
  }

  if (!result.data) {
    return reportGQLError("No Data returned");
  }

  return result.data;
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
  const data = await processQuery(url, payload);
  return data?.runtimes.find((x: RuntimeDescriptor) => x.id === rt.id) || null;
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
  const data = await processQuery(url, payload);
  return data?.createRuntime || null;
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
          ({ serviceId, serviceName, uuid, ...config }) =>
            `{instanceId: "${uuid}", serviceId: "${serviceId}", serviceName: "${serviceName}", config: ${encodeJsonObject(
              config
            )}}`
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
  const data = await processQuery(url, payload);
  return data.restoreRuntime;
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
        config
      }
    }
  }`;
  const data = await processQuery(url, payload);
  const createServiceResult = data?.runtimeById?.createService;
  if (!createServiceResult) {
    return null;
  }
  const { instanceId, config: initialConfig, ...svc } = createServiceResult;
  const config = initialConfig ? JSON.parse(initialConfig) : {};
  return { ...svc, ...config, uuid: createServiceResult.instanceId };
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
  const data = await processQuery(url, payload);
  return data?.runtimeById?.removeService;
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
  const data = await processQuery(url, payload);

  const config = data?.runtimeById?.serviceById?.config;
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
  const data = await processQuery(url, payload);
  const resultConfig = data?.runtimeById?.serviceById?.configure;
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
          params: ${encodeAny(params)}, 
          ${serviceInput}
        }
      ) { id }
    }
  }`;
  const data = await processQuery(url, payload);
  return data?.runtimeById?.process;
}

export async function getRuntimeOutputUrl(runtime: RuntimeDescriptor) {
  const url = `${runtime.url}/query`;
  const payload = `query getRuntimeOutputUrl {
    runtimeById(runtimeId: "${runtime.id}") {
      outputUrl
    }
  }`;
  const data = await processQuery(url, payload);
  return data?.runtimeById?.outputUrl;
}

function encodeJsonObject(obj: object): string {
  return JSON.stringify(JSON.stringify(obj));
}

function encodeAny(data: any): string {
  if (typeof data === "string") {
    return JSON.stringify(decodeURIComponent(data));
  }
  return encodeJsonObject(data);
}
