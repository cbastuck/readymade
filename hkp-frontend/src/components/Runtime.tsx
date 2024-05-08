import { CSSProperties, Component, ReactElement } from "react";
import { SemanticICONS } from "semantic-ui-react";

import { getServiceConfiguration } from "../core/actions";
//import NodeRuntime from "../runtime/NodeRuntime";
import BrowserRuntime from "../runtime/browser/BrowserRuntime";
import RemoteRuntime from "../runtime/remote/RemoteRuntime";
import ServiceDropdown from "./ServiceDropdown";

import { s, t } from "../styles";
import {
  RuntimeDescriptor,
  RuntimeImpl,
  ServiceAction,
  ServiceClass,
  ServiceDescriptor,
  InstanceId,
  RuntimeScope,
  OnResult,
  User,
} from "../types";
import { BoardContextState } from "../BoardContext";
import BrowserRuntimeScope from "../runtime/browser/BrowserRuntimeScope";

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
    icon: SemanticICONS;
    onClick: (ev: React.MouseEvent) => void;
  }>;
  disabledItems?: Array<string>;
  headless?: boolean;
  style?: CSSProperties;
  readonly?: boolean;
  expanded?: boolean;
  frameless?: boolean;
  highlightServicesOnHover?: boolean;

  onResult: OnResult;
  onArrangeService?: (serviceUuid: string, position: number) => void;
};

type State = {
  readonly: boolean;
  showSettings: boolean;
  expanded: boolean;
  wrapServices: boolean | undefined;
};

export default class Runtime extends Component<Props, State> {
  state: State = {
    readonly: false,
    showSettings: false,
    expanded: false,
    wrapServices: undefined,
  };

  impl: RuntimeImpl | null = null;
  dropdown: ServiceDropdown | null = null;
  runtimeContainer: HTMLDivElement | null = null;

  componentDidMount() {
    const { readonly, initialState = {}, expanded } = this.props;
    this.setState({
      readonly: !!readonly,
      wrapServices: initialState.wrapServices,
      expanded:
        expanded !== undefined ? expanded : initialState.minimized !== true,
      showSettings: false,
      ...initialState,
    });
  }

  componentDidUpdate(prevProps: Props) {
    const { readonly } = this.props;
    if (readonly !== prevProps.readonly) {
      this.setState({
        expanded: !readonly,
        readonly: !!readonly,
      });
    }
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

  renderRemoteRuntime = (
    scope: RuntimeScope,
    runtime: RuntimeDescriptor,
    expanded: boolean,
    user: User | null,
    boardName: string,
    services: Array<ServiceDescriptor>,
    _readonly: boolean,
    onArrangeService: (serviceUuid: string, position: number) => void
  ) => {
    const { wrapServices } = this.state;

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          width: "100%",
          flexFlow: wrapServices ? "wrap" : "row nowrap",
          overflow: wrapServices ? undefined : "auto",
        }}
      >
        <RemoteRuntime
          key={`remote-runtime-${runtime.id}`}
          collapsed={!expanded}
          scope={scope}
          user={user}
          boardName={boardName}
          runtime={runtime}
          services={services}
          onArrangeService={onArrangeService}
          onServiceAction={this.onServiceAction}
          onResult={this.props.onResult}
          highlightServicesOnHover={this.props.highlightServicesOnHover}
        />
        {services?.length === 0 && this.renderEmptyRuntimePlaceholder()}
      </div>
    );
  };

  renderBrowserRuntime = (
    scope: RuntimeScope,
    runtime: RuntimeDescriptor,
    expanded: boolean,
    user: User | null,
    boardName: string,
    services: Array<ServiceDescriptor>,
    _readonly: boolean,
    onArrangeService: (serviceUuid: string, position: number) => void,
    wrapServices?: boolean
  ) => {
    const { outputs, inputs, onResult } = this.props;
    if (scope) {
      scope.authenticatedUser = user;
    }
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          width: "100%",
          flexFlow: wrapServices ? "wrap" : "row nowrap",
          overflow: wrapServices ? undefined : "auto",
        }}
      >
        {inputs && expanded ? <>{inputs}</> : false}
        <BrowserRuntime
          key={`browser-runtime-${runtime.id}`}
          collapsed={!expanded}
          user={user}
          boardName={boardName}
          scope={scope as BrowserRuntimeScope}
          runtime={runtime}
          services={services}
          onArrangeService={onArrangeService}
          onServiceAction={this.onServiceAction}
          onResult={onResult}
          highlightServicesOnHover={this.props.highlightServicesOnHover}
        />
        {services?.length === 0 && this.renderEmptyRuntimePlaceholder()}
        {outputs && expanded ? <div className="ml-auto">{outputs}</div> : false}
      </div>
    );
  };

  renderEmptyRuntimePlaceholder() {
    return (
      <div
        style={{
          width: "100%",
          margin: "auto",
          textAlign: "center",
          minHeight: 220,
        }}
      >
        <div style={s(t.fs13, t.ls1, { marginTop: 90 })}>
          This is an empty runtime -
          <span
            style={{ cursor: "help", color: "#4284C4" }}
            onClick={() => {
              document
                .getElementById(`service-selector-${this.props.runtime.id}`)
                ?.click();
            }}
          >
            {" add services "}
          </span>
          to start
        </div>
      </div>
    );
  }

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

    const readonly = false; // TODO: was if no registry is available

    const onArrangeServiceDefault = (serviceUuid: string, position: number) =>
      runtime &&
      boardContext &&
      boardContext.arrangeService(runtime, serviceUuid, position);

    const onArrangeService =
      onArrangeServiceCustom !== undefined
        ? onArrangeServiceCustom
        : onArrangeServiceDefault;

    const scope = boardContext.scopes[runtimeId];

    const renderActualRuntime = (headless: boolean) => {
      return runtime.type === "remote"
        ? this.renderRemoteRuntime(
            scope,
            runtime,
            headless ? false : expanded,
            user,
            boardName || "",
            services,
            readonly,
            onArrangeService
          )
        : runtime.type === "browser"
        ? this.renderBrowserRuntime(
            scope,
            runtime,
            headless ? false : expanded,
            user,
            boardName || "",
            services,
            readonly,
            onArrangeService,
            wrapServices
          )
        : null;
    };

    // TODO: this lead to a full re-rerender for BrowserRuntimes in BoardService when expading/collapsing
    /*
    if (headless && runtime) {
      return renderActualRuntime(true);
    }
    */

    return (
      <RuntimeUI
        frameless={frameless}
        headless={headless}
        style={style}
        isExpanded={expanded}
        wrapServices={wrapServices}
        runtime={runtime}
        registry={registry}
        onExpand={(expanded: boolean) => this.setState({ expanded })}
        onAddService={this.onAddService}
        onWrapServices={(isWrapped: boolean) =>
          this.setState({ wrapServices: isWrapped })
        }
      >
        {runtime && renderActualRuntime(headless)}
        {services && services.length === 0 && !headless && (
          <div style={{ height: showSettings ? 180 : 10 }} /> // just a placeholder for visual consistence
        )}
      </RuntimeUI>
    );
  }
}
