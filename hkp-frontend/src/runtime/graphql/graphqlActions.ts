import {
  InstanceId,
  ProcessContext,
  RuntimeClass,
  RuntimeDescriptor,
  ServiceClass,
  ServiceDescriptor,
  ServiceRegistry,
  User,
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

async function processQuery(url: string, query: string, user?: User | null) {
  const headers: HeadersInit = { "content-type": "application/json" };
  if (user && user.idToken) {
    headers["authorization"] = `Bearer ${user.idToken}`;
  }

  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify({
      query,
    }),
    headers,
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
  // TODO: why is this a mutation?
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
  desc: RuntimeClass,
  user: User | null
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
  const data = await processQuery(url, payload, user);
  return data?.createRuntime || null;
}

export async function restoreRuntime(
  runtime: RuntimeDescriptor,
  services: Array<ServiceDescriptor>,
  user: User | null
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
          config
        }
      }
    }`;
  try {
    const data = await processQuery(url, payload, user);
    return data.restoreRuntime;
  } catch (err: any) {
    const message = `Restore runtime failed: ${url}: ${err.message}`;
    throw new Error(message);
  }
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
  const data = await processQuery(url, payload, runtime.user);
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
  const data = await processQuery(url, payload, runtime.user);
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
  const data = await processQuery(url, payload, runtime.user);

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
  const data = await processQuery(url, payload, runtime.user);
  const resultConfig = data?.runtimeById?.serviceById?.configure;
  return resultConfig ? JSON.parse(resultConfig) : null;
}

export async function processRuntime(
  runtime: RuntimeDescriptor,
  params: any,
  service: InstanceId | null,
  context?: ProcessContext | null
) {
  const url = `${runtime.url}/query`;
  const serviceInput = service
    ? `instanceId: "${service.uuid}"`
    : "instanceId: null";
  const requestId = `requestId: "${context?.requestId || null}"`;
  const payload = `query processRuntime {
    runtimeById(runtimeId: "${runtime.id}") {
      process(
        input: {
          params: ${encodeAny(params)}, 
          ${serviceInput},
          ${requestId}
        }
      ) { id }
    }
  }`;
  const data = await processQuery(url, payload, runtime.user);
  return data?.runtimeById?.process;
}

export async function rearrangeServices(
  runtime: RuntimeDescriptor,
  newOrder: Array<InstanceId>
): Promise<Array<InstanceId>> {
  const url = `${runtime.url}/query`;

  const payload = `query rearrangeServices {
    runtimeById(runtimeId: "${runtime.id}") {
      rearrangeServices(
        input: {
          newOrder: ${JSON.stringify(newOrder.map((x) => x.uuid))} ,
        }
      ) { instanceId }
    }
  }`;
  const data = await processQuery(url, payload, runtime.user);
  return data?.runtimeById?.rearrangeServices?.map((x: any) => ({
    uuid: x.instanceId,
  }));
}

export async function getRuntimeOutputUrl(runtime: RuntimeDescriptor) {
  const url = `${runtime.url}/query`;
  const payload = `query getRuntimeOutputUrl {
    runtimeById(runtimeId: "${runtime.id}") {
      outputUrl
    }
  }`;
  const data = await processQuery(url, payload, runtime.user);
  return data?.runtimeById?.outputUrl;
}

export async function getHealth(rtClass: RuntimeClass, user: User | null) {
  const url = rtClass.url;
  if (!url) {
    throw new Error("Remote class property missing: url");
  }
  const headers: HeadersInit = { "content-type": "application/json" };
  if (user && user.idToken) {
    headers["authorization"] = `Bearer ${user.idToken}`;
  }

  const res = await fetch(`${url}/health`, { headers });
  return res.status.toString();
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
