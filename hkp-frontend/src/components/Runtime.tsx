import { Component, ReactElement } from "react";
import { Icon, Sidebar, Segment, Menu, SemanticICONS } from "semantic-ui-react";

import { getServiceConfiguration } from "../core/actions";
//import NodeRuntime from "../runtime/NodeRuntime";
import BrowserRuntime from "../runtime/browser/BrowserRuntime";
import RemoteRuntime from "../runtime/remote/RemoteRuntime";
import ServiceDropdown from "./ServiceDropdown";

import { s, t } from "../styles";
import {
  AppViewMode,
  RuntimeDescriptor,
  RuntimeImpl,
  ServiceAction,
  ServiceClass,
  ServiceDescriptor,
  InstanceId,
  ServiceRegistry,
  RuntimeScope,
  OnResult,
  User,
} from "../types";
import { BoardContextState } from "../BoardContext";
import BrowserRuntimeScope from "../runtime/browser/BrowserRuntimeScope";
import RenameRuntimeAccessory from "./RenameRuntimeAccessory";
import ProcessRuntimeAccessory from "./ProcessRuntimeAccessory";

type Props = {
  boardContext: BoardContextState;
  initialState: {
    wrapServices?: boolean;
    minimized?: boolean;
  };
  runtime: RuntimeDescriptor;
  outputs?: ReactElement;
  inputs?: ReactElement;
  children?: JSX.Element | JSX.Element[];
  customItems?: Array<{
    key: string;
    icon: SemanticICONS;
    onClick: (ev: React.MouseEvent) => void;
  }>;
  disabledItems?: Array<string>;
  headless?: boolean;
  style?: object;
  readonly?: boolean;
  expanded?: boolean;
  frameless?: boolean;

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

  onAddService(service: ServiceClass) {
    const { boardContext, runtime } = this.props;
    if (boardContext && runtime) {
      boardContext.addService(service, runtime);
    }
  }

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
      service.configure(config);
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

  renderServiceMenu(
    runtimeId: string,
    registry: ServiceRegistry,
    appViewMode: AppViewMode
  ) {
    const wide = appViewMode === "wide";
    const options = registry.map((s) => ({
      key: `${runtimeId}${s.serviceId}`,
      value: s.serviceId,
      text: s.serviceName,
      selected: false,
    }));

    return (
      <ServiceDropdown
        ref={(dropdown) => (this.dropdown = dropdown)}
        options={options}
        wide={wide}
        onSelected={(serviceId: string) => {
          const service = registry.find((s) => s.serviceId === serviceId);
          if (service) {
            this.onAddService(service);
          }
        }}
      />
    );
  }

  renderExpandableHeadline(
    runtimeId: string,
    name: string,
    registry: ServiceRegistry,
    isOwner: boolean,
    appViewMode: AppViewMode
  ) {
    const { expanded, showSettings } = this.state;

    return (
      <div
        style={{
          width: "100%",
          marginTop: 5,
          marginLeft: 5,
          display: "flex",
          flexDirection: "row",
        }}
      >
        <Icon
          name="bars"
          style={{
            margin: "10px 18px",
            cursor: "pointer",
            color: "#ddd",
          }}
          onClick={() =>
            this.setState({
              showSettings: expanded && !showSettings,
              expanded: !expanded ? !showSettings : expanded,
            })
          }
        />
        <div
          style={
            {
              ...t.unselectable,
              fontSize: 12,
              letterSpacing: 1,
              textTransform: "uppercase",
              marginTop: 10,
              display: "flex",
              flexDirection: "row",
              width: "100%",
            } as any
          }
        >
          <RenameRuntimeAccessory
            name={name}
            runtimeId={runtimeId}
            onChangeName={(newName) =>
              this.props.boardContext.setRuntimeName(runtimeId, newName)
            }
          />
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              width: "100%",
              marginLeft: 10,
            }}
          >
            <ProcessRuntimeAccessory
              onProcess={() => {
                const rt = this.props.runtime;
                const scope = this.props.boardContext.scopes[rt.id];
                const api = this.props.boardContext.runtimeApis[rt.type];
                if (scope && api) {
                  api.processRuntime(scope, null, null);
                }
              }}
            />
          </div>
        </div>
        <div
          style={{
            marginRight: 10,
            marginTop: 5,
            marginBottom: 10,
            marginLeft: "auto",
            textAlign: "right",
          }}
        >
          {registry &&
            isOwner &&
            this.renderServiceMenu(runtimeId, registry, appViewMode)}
        </div>
      </div>
    );
  }

  renderSettings = (
    runtime: RuntimeDescriptor,
    onToggleOwnership: () => void,
    isOwner: boolean
  ) => {
    const { expanded, showSettings, wrapServices } = this.state;
    const { boardContext, customItems = [], disabledItems = [] } = this.props;
    const { services: allServices = {} } = boardContext;
    const services = allServices[runtime.id];
    const itemStyle = {
      height: 40,
      margin: 0,
    };
    return (
      <Menu vertical compact style={{ height: "100%" }}>
        <Menu.Item
          as="a"
          style={itemStyle}
          onClick={() =>
            services.length === 0
              ? boardContext.removeRuntime(runtime)
              : boardContext.removeAllServices(runtime)
          }
          disabled={disabledItems.indexOf("remove") !== -1}
        >
          <Icon
            name={
              !services || services.length === 0
                ? "trash alternate outline"
                : "remove"
            }
          />
        </Menu.Item>
        {
          <Menu.Item
            as="a"
            style={itemStyle}
            onClick={() =>
              this.setState({
                expanded: !expanded,
                showSettings: showSettings && !expanded,
              })
            }
          >
            <Icon name="compress" />
          </Menu.Item>
        }
        <Menu.Item
          as="a"
          style={itemStyle}
          onClick={() => this.setState({ wrapServices: !wrapServices })}
        >
          <Icon name={wrapServices ? "exchange" : "sort amount down"} />
        </Menu.Item>
        {false && (
          <Menu.Item as="a" style={itemStyle} onClick={() => {}}>
            <Icon name="keyboard" />
          </Menu.Item>
        )}
        {false && runtime && runtime.type === "browser" && (
          <Menu.Item
            as="a"
            style={itemStyle}
            onClick={() => onToggleOwnership && onToggleOwnership()}
          >
            <Icon name={isOwner ? "unlink" : "linkify"} />
          </Menu.Item>
        )}
        {customItems.map((item, idx) => (
          <Menu.Item
            key={`custom-item-${item.key}-${idx}`}
            as="a"
            style={itemStyle}
            onClick={(ev: React.MouseEvent) => {
              item.onClick(ev);
              this.setState({
                showSettings: false,
              });
            }}
          >
            <Icon name={item.icon} />
          </Menu.Item>
        ))}
      </Menu>
    );
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

  /*
  renderNodeRuntime = (
    runtime: RuntimeDescriptor,
    expanded: boolean,
    userId: string,
    boardName: string,
    services: Array<ServiceDescriptor>,
    readonly: boolean,
    registry: ServiceRegistry,
    onArrangeService: (serviceUuid: string, position: number) => void
  ) => {
    if (expanded) {
      return (
        <NodeRuntime
          ref={(rt) => (this.impl = rt)}
          userId={userId}
          boardName={boardName}
          runtime={runtime}
          services={services}
          readonly={readonly}
          registry={registry}
          onArrangeService={onArrangeService}
          onServiceAction={this.onServiceAction}
          onResult={this.props.onResult}
        />
      );
    }
    return false;
  };
  */

  renderRemoteRuntime = (
    scope: RuntimeScope,
    runtime: RuntimeDescriptor,
    expanded: boolean,
    user: User | null,
    boardName: string,
    services: Array<ServiceDescriptor>,
    readonly: boolean,
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
          collapsed={!expanded}
          scope={scope}
          user={user}
          boardName={boardName}
          runtime={runtime}
          services={services}
          readonly={readonly}
          onArrangeService={onArrangeService}
          onServiceAction={this.onServiceAction}
          onResult={this.props.onResult}
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
    readonly: boolean,
    onArrangeService: (serviceUuid: string, position: number) => void,
    wrapServices?: boolean
  ) => {
    const { outputs, inputs, onResult } = this.props;
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
        {inputs && expanded ? (
          <div
            style={{
              marginBottom: 15,
            }}
          >
            {inputs}
          </div>
        ) : (
          false
        )}
        <BrowserRuntime
          collapsed={!expanded}
          user={user}
          boardName={boardName}
          scope={scope as BrowserRuntimeScope}
          runtime={runtime}
          services={services}
          readonly={readonly}
          onArrangeService={onArrangeService}
          onServiceAction={this.onServiceAction}
          onResult={onResult}
        />
        {services?.length === 0 && this.renderEmptyRuntimePlaceholder()}
        {outputs && expanded ? (
          <div
            style={{
              marginLeft: "auto",
              marginBottom: 15,
            }}
          >
            {outputs}
          </div>
        ) : (
          false
        )}
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
        <div style={s(t.uc, t.fs13, t.ls1, { marginTop: 90 })}>
          This is an empty runtime -
          <span
            style={{ cursor: "help", color: "#4284C4" }}
            onClick={(ev) => {
              if (this.dropdown) {
                this.dropdown.open(ev);
              }
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
      children = undefined,
      onArrangeService: onArrangeServiceCustom = undefined,
      headless = false,
    } = this.props;

    const runtimeId = runtime && runtime.id;
    const runtimeName = runtime ? runtime.name : "Blank";
    const services =
      runtime && boardContext && boardContext.services[runtime.id];
    const user = boardContext && boardContext.user && boardContext.user;
    const boardName = boardContext && boardContext.boardName;
    const registry =
      runtime && boardContext && boardContext.registry[runtime.id];
    const appViewMode = boardContext && boardContext.appViewMode;
    const wide = boardContext ? appViewMode === "wide" : true;
    const isOwner = boardContext && boardContext.isRuntimeInScope(runtime);

    const { wrapServices = !wide, showSettings, expanded } = this.state;

    const readonly = false; // TODO: was if no registry is available
    const readonlyStyle: any =
      readonly && !frameless
        ? {
            backgroundColor: "#FFFFFF",
            opacity: 0.3,
            width: "100%",
            zIndex: 200000,
            cursor: "not-allowed",
            display: !expanded && "none",
          }
        : {};

    const onArrangeServiceDefault = (serviceUuid: string, position: number) =>
      runtime &&
      boardContext &&
      boardContext.arrangeService(runtime, serviceUuid, position);

    const onArrangeService =
      onArrangeServiceCustom !== undefined
        ? onArrangeServiceCustom
        : onArrangeServiceDefault;

    const onToggleOwnership = () =>
      boardContext &&
      runtime &&
      (boardContext.isRuntimeInScope(runtime)
        ? boardContext.releaseRuntimeScope(boardContext.boardName, runtime)
        : boardContext.acquireRuntimeScope(boardContext.boardName, runtime));

    const scope = boardContext.scopes[runtimeId];

    const renderActualRuntime = (headless: boolean) => {
      return runtime.type === "remote"
        ? this.renderRemoteRuntime(
            scope,
            runtime,
            headless ? false : expanded,
            user,
            boardName,
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
            boardName,
            services,
            readonly,
            onArrangeService,
            wrapServices
          )
        : null;
    };

    if (headless && runtime) {
      return renderActualRuntime(true);
    }

    return (
      <div
        style={
          {
            border: !frameless && "solid 1px lightgray",
            borderRadius: 3,
            backgroundColor: !frameless && "#EEEEEE10",
            ...style,
          } as any
        }
      >
        {!frameless &&
          this.renderExpandableHeadline(
            runtimeId,
            runtimeName,
            registry,
            isOwner,
            appViewMode
          )}
        <Sidebar.Pushable
          as={Segment}
          style={{
            border: "none",
            boxShadow: "none",
            margin: 0,
            // Workaround: https://github.com/Semantic-Org/Semantic-UI-React/issues/2897
            // without it, the fullscreen is not working, eg. canvas service
            transform: "none",
          }}
        >
          <Sidebar
            animation="overlay"
            direction="left"
            width="very thin"
            visible={showSettings}
            style={{
              overflowX: "hidden",
              boxShadow: "0 0 2px rgba(34,36,38,.15)",
            }}
          >
            {this.renderSettings(runtime, onToggleOwnership, isOwner)}
          </Sidebar>
          <div
            ref={(c) => {
              this.runtimeContainer = c;
            }}
            style={readonlyStyle}
            onClickCapture={(e) => readonly && e.stopPropagation()}
          >
            {runtime && renderActualRuntime(false)}
            {((services && services.length === 0) || !isOwner) && (
              <div style={{ height: showSettings ? 180 : 10 }} /> // just a placeholder for visual consistence
            )}
          </div>
          {children && (
            <div
              style={{
                margin: "5px",
                padding: 10,
                border: "dashed 1px lightgray",
                borderRadius: 5,
              }}
            >
              <div style={{ marginBottom: 5 }} />
              {children}
            </div>
          )}
        </Sidebar.Pushable>
      </div>
    );
  }
}
