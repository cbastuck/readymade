import {
  CSSProperties,
  ReactElement,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { getServiceConfiguration } from "../core/actions";

import {
  RuntimeDescriptor,
  RuntimeImpl,
  ServiceAction,
  ServiceClass,
  InstanceId,
  OnResult,
  ProcessRuntimeByName,
  ServiceInstance,
  InitialServiceFrameState,
} from "../types";
import { BoardContextState } from "../BoardContext";

import RuntimeUI from "hkp-frontend/src/ui-components/runtime-ui";
import { usePlatform } from "../platform/PlatformContext";
import DropTarget from "./DropTarget";
import {
  HKP_DND_SERVICE_TYPE,
  HKP_DND_SERVICE_CLASS_TYPE,
  isServiceInstanceDrop,
} from "./DropTypes";

type Props = {
  boardContext: BoardContextState;
  initialState: {
    wrapServices?: boolean;
    minimized?: boolean;
  };
  initialServiceFrameState?: InitialServiceFrameState;
  runtime: RuntimeDescriptor;
  outputs?: ReactElement;
  inputs?: ReactElement;
  customItems?: Array<{
    key: string;
    icon: ReactElement;
    onClick: (ev: React.MouseEvent) => void;
  }>;
  disabledItems?: Array<string>;
  headless?: boolean;
  style?: CSSProperties;

  expanded?: boolean;
  frameless?: boolean;

  onResult: OnResult;
  processRuntimeByName: ProcessRuntimeByName;
  onArrangeService?: (serviceUuid: string, position: number) => void;
};

export type RuntimeHandle = {
  processRuntime: (params: any, svc?: InstanceId | null) => Promise<any>;
  processService: (serviceUuid: string, params: any) => void;
  configureService: (serviceUuid: string, config: any) => Promise<void>;
  destroyService: (serviceUuid: string) => any;
  destroyRuntime: () => any;
  scrollRuntimeContainerToRight: () => void;
  scrollRuntimeContainerTo: (x: number, y: number) => void;
};

const Runtime = forwardRef<RuntimeHandle, Props>(function Runtime(props, _ref) {
  const platform = usePlatform();
  const {
    style,
    runtime,
    boardContext,
    frameless = false,
    onArrangeService: onArrangeServiceCustom = undefined,
    headless = false,
    initialState = {},
    expanded: expandedProp,
  } = props;

  const [showSettings, setShowSettings] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [wrapServices, setWrapServices] = useState<boolean | undefined>(
    undefined,
  );
  const [isSvcClassDragOver, setIsSvcClassDragOver] = useState(false);

  const implRef = useRef<RuntimeImpl | null>(null);
  const runtimeContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setWrapServices(initialState.wrapServices);
    setExpanded(
      expandedProp !== undefined
        ? expandedProp
        : initialState.minimized !== true,
    );
    setShowSettings(false);
    const scope = boardContext.scopes[runtime.id];
    if (scope) {
      scope.setState?.(initialState);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAddService = (
    svcClass: ServiceClass,
    prototype?: ServiceInstance,
  ) => {
    return boardContext && runtime
      ? boardContext.addService(svcClass, runtime, prototype)
      : null;
  };

  const onServiceAction = (command: ServiceAction) => {
    const { service, action } = command;
    switch (action) {
      case "remove": {
        if (boardContext && runtime && service) {
          return boardContext.removeService(service, runtime);
        }
        break;
      }
      case "getConfig": {
        if (!boardContext || !boardContext.boardName || !runtime || !service) {
          return;
        }
        return getServiceConfiguration(
          // TODO: this should go through the BoardContext
          // This does not work for services in BrowserRuntimes
          boardContext.boardName,
          service,
          runtime,
        );
      }
      case "rename": {
        const {
          payload: { value },
        } = command;
        if (service && value && runtime) {
          boardContext.setServiceName(runtime.id, service.uuid, value);
        }
        break;
      }
      default:
        console.log("Runtime processing unknown service action: ", action);
    }
  };

  // TODO: implRef.current is null
  const getServiceById = (serviceUuid: string) => {
    return (
      implRef.current &&
      implRef.current.getServiceById &&
      implRef.current.getServiceById(serviceUuid)
    );
  };

  // TODO: NOBODY SHOULD CALL THIS ANYMORE
  const processRuntime = (
    params: any,
    svc: InstanceId | null = null,
  ): Promise<any> => {
    if (!implRef.current || !implRef.current.processRuntime) {
      throw new Error("Runtime.processRuntime() impl is missing");
    }
    return implRef.current.processRuntime(params, svc);
  };

  const processService = (serviceUuid: string, params: any) => {
    const service = getServiceById(serviceUuid);
    if (service) {
      service.process(params);
    } else {
      console.error("Process service failed", serviceUuid);
    }
  };

  const configureService = async (serviceUuid: string, config: any) => {
    const service = getServiceById(serviceUuid);
    if (service) {
      service.configure?.(config);
    } else {
      console.error(
        "configureService() Can not find service by id: ",
        serviceUuid,
        boardContext.services,
        runtime,
      );
    }
  };

  // TODO: this should not happen here. Is a command to the backend not the UI component
  // Probably the boardContext should be the receiver
  const destroyService = (serviceUuid: string) => {
    if (!implRef.current || !implRef.current.destroyService) {
      throw new Error("Runtime.destroyService() impl is missing");
    }
    return implRef.current.destroyService(serviceUuid);
  };

  // TODO: implRef.current is NULL
  const destroyRuntime = () => {
    if (!implRef.current || !implRef.current.destroyRuntime) {
      throw new Error("Runtime.destroyRuntime() impl is missing");
    }
    return implRef.current.destroyRuntime();
  };

  const scrollRuntimeContainerToRight = () => {
    if (runtimeContainerRef.current) {
      scrollRuntimeContainerTo(runtimeContainerRef.current.scrollWidth, 0);
    }
  };

  const scrollRuntimeContainerTo = (x: number, y: number) => {
    if (runtimeContainerRef.current) {
      runtimeContainerRef.current.scroll(x, y);
    }
  };

  useImperativeHandle(_ref, () => ({
    processRuntime,
    processService,
    configureService,
    destroyService,
    destroyRuntime,
    scrollRuntimeContainerToRight,
    scrollRuntimeContainerTo,
  }));

  const runtimeId = runtime && runtime.id;

  const services =
    (runtime && boardContext && boardContext.services[runtime.id]) || [];
  const user = (boardContext && boardContext.appContext?.user) || null;
  const boardName = boardContext && boardContext.boardName;
  const registry = runtime && boardContext && boardContext.registry[runtime.id];

  const appViewMode = boardContext && boardContext.appContext?.appViewMode;
  const wide = boardContext ? appViewMode === "wide" : true;

  const effectiveWrapServices =
    wrapServices !== undefined ? wrapServices : !wide;

  const onArrangeServiceDefault = (serviceUuid: string, position: number) =>
    runtime &&
    boardContext &&
    boardContext.arrangeService(runtime, serviceUuid, position);

  const onArrangeService =
    onArrangeServiceCustom !== undefined
      ? onArrangeServiceCustom
      : onArrangeServiceDefault;

  const scope = boardContext.scopes[runtimeId];

  const onWrapServices = (isWrapped: boolean) => {
    setWrapServices(isWrapped);
    scope?.setState?.({ wrapServices: isWrapped }); // TODO: remove state duplication
  };

  const onExpand = (isExpanded: boolean) => {
    setExpanded(isExpanded);
    scope?.setState?.({ minimized: !isExpanded }); // TODO: remove state duplication
  };

  const onDropService = (data: any) => {
    if (data) {
      const serviceData = JSON.parse(data);
      if (isServiceInstanceDrop(serviceData)) {
        const descriptor = serviceData.descriptor;
        onAddService(descriptor, serviceData);
      }
    }
  };

  const onSaveRuntime = async () => {
    const payload = {
      ...runtime,
      services: services?.map(({ serviceId, serviceName, state, uuid }) => ({
        uuid,
        serviceId,
        name: serviceName,
        state,
      })),
    };
    const json = JSON.stringify(payload);
    const filename = `runtime-${runtime.name}.json`;

    if (platform.saveRuntimeToDisk) {
      await platform.saveRuntimeToDisk(json, filename);
      return;
    }

    const saveLink = document.createElement("a");
    const blob = new Blob([json], { type: "application/json" });
    saveLink.href = URL.createObjectURL(blob);
    saveLink.download = filename;
    saveLink.click();
    setTimeout(() => {
      URL.revokeObjectURL(saveLink.href);
      saveLink.remove();
    }, 60000);
  };

  return (
    <div
      className={isSvcClassDragOver ? "hkp-runtime-svc-drop-active" : undefined}
      onDragOver={(ev) => {
        if (ev.dataTransfer.types.includes(HKP_DND_SERVICE_CLASS_TYPE)) {
          setIsSvcClassDragOver(true);
          ev.preventDefault();
        }
      }}
      onDragLeave={() => setIsSvcClassDragOver(false)}
      onDrop={(ev) => {
        const data = ev.dataTransfer.getData(HKP_DND_SERVICE_CLASS_TYPE);
        if (data) {
          setIsSvcClassDragOver(false);
          onAddService(JSON.parse(data) as ServiceClass);
          ev.preventDefault();
          ev.stopPropagation();
        }
      }}
    >
      <DropTarget
        acceptedType={HKP_DND_SERVICE_TYPE}
        disabled={!services || services.length > 0} // only drop services to empty runtime, otherwise use the drop bars to locate
        onDrop={onDropService}
      >
        <RuntimeUI
          scope={scope}
          services={services}
          onServiceAction={onServiceAction}
          onArrangeService={onArrangeService}
          boardName={boardName || null}
          user={user}
          frameless={frameless}
          headless={headless}
          style={style}
          isExpanded={expanded}
          wrapServices={effectiveWrapServices}
          runtime={runtime}
          registry={registry}
          inputs={props.inputs}
          outputs={props.outputs}
          onExpand={onExpand}
          onAddService={onAddService}
          onWrapServices={onWrapServices}
          onResult={props.onResult}
          processRuntimeByName={props.processRuntimeByName}
          initialServiceFrameState={props.initialServiceFrameState}
          onSave={onSaveRuntime}
        >
          {services && services.length === 0 && !headless && (
            <div style={{ height: showSettings ? 180 : 10 }} /> // just a placeholder for visual consistence
          )}
        </RuntimeUI>
      </DropTarget>
    </div>
  );
});

export default Runtime;
