import { CSSProperties, Component, ReactElement } from "react";

import { getServiceConfiguration } from "../core/actions";
import ServiceDropdown from "./ServiceDropdown";

import {
  RuntimeDescriptor,
  RuntimeImpl,
  ServiceAction,
  ServiceClass,
  InstanceId,
  OnResult,
} from "../types";
import { BoardContextState } from "../BoardContext";

import RuntimeUI from "@/ui-components/runtime-ui";

type Props = {
  boardContext: BoardContextState;
  initialState: {
    wrapServices?: boolean;
    minimized?: boolean;
  };
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
  highlightServicesOnHover?: boolean;

  onResult: OnResult;
  onArrangeService?: (serviceUuid: string, position: number) => void;
};

type State = {
  showSettings: boolean;
  expanded: boolean;
  wrapServices: boolean | undefined;
};

export default class Runtime extends Component<Props, State> {
  state: State = {
    showSettings: false,
    expanded: false,
    wrapServices: undefined,
  };

  impl: RuntimeImpl | null = null;
  dropdown: ServiceDropdown | null = null;
  runtimeContainer: HTMLDivElement | null = null;

  componentDidMount() {
    const { initialState = {}, expanded } = this.props;
    this.setState({
      wrapServices: initialState.wrapServices,
      expanded:
        expanded !== undefined ? expanded : initialState.minimized !== true,
      showSettings: false,
      ...initialState,
    });
  }

  onAddService = (service: ServiceClass) => {
    const { boardContext, runtime } = this.props;
    if (boardContext && runtime) {
      boardContext.addService(service, runtime);
    }
  };

  onServiceAction = (command: ServiceAction) => {
    const { boardContext, runtime } = this.props;
    const { service, action } = command;
    switch (action) {
      case "remove": {
        if (boardContext && runtime && service) {
          return boardContext.removeService(service, runtime);
        }
        break;
      }
      case "getConfig": {
        return getServiceConfiguration(
          // TODO: this should g  o through BoardContext
          // This does not work for services in BeowserRuntimes
          boardContext.boardName,
          service,
          runtime
        );
      }
      default:
        console.log("Runtime processing unknown service action", action);
    }
  };

  // TODO: this.impl is null
  getServiceById = (serviceUuid: string) => {
    return (
      this.impl &&
      this.impl.getServiceById &&
      this.impl.getServiceById(serviceUuid)
    );
  };

  // TODO: NOBODY SHOULD CALL THIS ANYMORE
  processRuntime = (
    params: any,
    svc: InstanceId | null = null
  ): Promise<any> => {
    if (!this.impl || !this.impl.processRuntime) {
      throw new Error("Runtime.processRuntime() impl is missing");
    }
    return this.impl.processRuntime(params, svc);
  };

  processService = (serviceUuid: string, params: any) => {
    const service = this.getServiceById(serviceUuid);
    if (service) {
      service.process(params);
    } else {
      console.error("Process service failed", serviceUuid);
    }
  };

  configureService = async (serviceUuid: string, config: any) => {
    const service = this.getServiceById(serviceUuid);
    if (service) {
      service.configure?.(config);
    } else {
      console.error(
        "configureService() Can not find service by id: ",
        serviceUuid,
        this.props.boardContext.services,
        this.props.runtime
      );
    }
  };

  // TODO: this should not happen here. Is a command to the backend not the UI component
  // Probably the boardContext should be the receiver
  destroyService = (serviceUuid: string) => {
    if (!this.impl || !this.impl.destroyService) {
      throw new Error("Runtime.destroyService() impl is missing");
    }
    return this.impl.destroyService(serviceUuid);
  };

  // TODO: this.impl is NULL
  destroyRuntime = () => {
    if (!this.impl || !this.impl.destroyRuntime) {
      throw new Error("Runtime.destroyRuntime() impl is missing");
    }
    return this.impl.destroyRuntime();
  };

  scrollRuntimeContainerToRight = () => {
    if (this.runtimeContainer) {
      this.scrollRuntimeContainerTo(this.runtimeContainer.scrollWidth, 0);
    }
  };

  scrollRuntimeContainerTo = (x: number, y: number) => {
    if (this.runtimeContainer) {
      this.runtimeContainer.scroll(x, y);
    }
  };

  render() {
    const {
      style,
      runtime,
      boardContext,
      frameless = false,

      onArrangeService: onArrangeServiceCustom = undefined,
      headless = false,
    } = this.props;

    const runtimeId = runtime && runtime.id;

    const services =
      runtime && boardContext && boardContext.services[runtime.id];
    const user = (boardContext && boardContext.appContext?.user) || null;
    const boardName = boardContext && boardContext.boardName;
    const registry =
      runtime && boardContext && boardContext.registry[runtime.id];

    const appViewMode = boardContext && boardContext.appContext?.appViewMode;
    const wide = boardContext ? appViewMode === "wide" : true;

    const { wrapServices = !wide, showSettings, expanded } = this.state;

    const onArrangeServiceDefault = (serviceUuid: string, position: number) =>
      runtime &&
      boardContext &&
      boardContext.arrangeService(runtime, serviceUuid, position);

    const onArrangeService =
      onArrangeServiceCustom !== undefined
        ? onArrangeServiceCustom
        : onArrangeServiceDefault;

    const scope = boardContext.scopes[runtimeId];

    return (
      <RuntimeUI
        scope={scope}
        services={services}
        onServiceAction={this.onServiceAction}
        onArrangeService={onArrangeService}
        boardName={boardName || null}
        user={user}
        frameless={frameless}
        headless={headless}
        style={style}
        isExpanded={expanded}
        wrapServices={wrapServices}
        runtime={runtime}
        registry={registry}
        inputs={this.props.inputs}
        outputs={this.props.outputs}
        onExpand={(expanded: boolean) => this.setState({ expanded })}
        onAddService={this.onAddService}
        onWrapServices={(isWrapped: boolean) =>
          this.setState({ wrapServices: isWrapped })
        }
        onResult={this.props.onResult}
      >
        {services && services.length === 0 && !headless && (
          <div style={{ height: showSettings ? 180 : 10 }} /> // just a placeholder for visual consistence
        )}
      </RuntimeUI>
    );
  }
}
