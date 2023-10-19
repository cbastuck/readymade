import { Component, ReactElement } from "react";
import {
  Icon,
  Sidebar,
  Segment,
  Menu,
  Input,
  Button,
  SemanticICONS,
} from "semantic-ui-react";

import { getServiceConfiguration } from "../core/actions";
//import NodeRuntime from "../runtime/NodeRuntime";
import BrowserRuntime from "../runtime/BrowserRuntime";
import RemoteRuntime from "../runtime/RemoteRuntime";
import ServiceDropdown from "./ServiceDropdown";

import { s, t } from "../styles";
import {
  AppViewMode,
  RuntimeDescriptor,
  RuntimeImpl,
  ServiceAction,
  ServiceClass,
  ServiceDescriptor,
  ServiceId,
  ServiceRegistry,
} from "../types";
import { BoardContextState } from "../BoardContext";

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

  onResult: (
    uuid: string,
    result: any,
    requestId: string | null
  ) => Promise<void>;
  onArrangeService?: (serviceUuid: string, position: number) => void;
};

type State = {
  runtimeNameEditBuffer: string;
  expanded: boolean;
  readonly: boolean;
  showSettings: boolean;
  wrapServices: boolean | undefined;
};

export default class Runtime extends Component<Props, State> {
  state: State = {
    expanded: false,
    readonly: false,
    showSettings: false,
    wrapServices: undefined,
    runtimeNameEditBuffer: "",
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
      runtimeNameEditBuffer: "",
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

  serialize = () => ({
    wrapServices: !!this.state.wrapServices,
    minimized: !this.state.expanded,
  });

  getServiceById = (serviceUuid: string) => {
    return (
      this.impl &&
      this.impl.getServiceById &&
      this.impl.getServiceById(serviceUuid)
    );
  };

  processRuntime = (
    params: any,
    svc: ServiceId | null = null
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
    const { expanded, showSettings, runtimeNameEditBuffer = "" } = this.state;

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
            } as any
          }
          onDoubleClick={() =>
            !runtimeNameEditBuffer && this.setState({ expanded: !expanded })
          }
          onClick={() =>
            !runtimeNameEditBuffer &&
            this.setState({ runtimeNameEditBuffer: name })
          }
        >
          {runtimeNameEditBuffer ? (
            <div
              style={{ display: "flex", flexDirection: "row", marginTop: -5 }}
            >
              <Input
                ref={(elem) => elem && elem.focus()}
                value={runtimeNameEditBuffer}
                onChange={(ev, { value: runtimeNameEditBuffer }) =>
                  this.setState({ runtimeNameEditBuffer })
                }
                onKeyUp={(ev: KeyboardEvent) => {
                  if (ev.key === "Enter") {
                    this.props.boardContext.setRuntimeName(
                      runtimeId,
                      runtimeNameEditBuffer
                    );
                    this.setState({ runtimeNameEditBuffer: "" });
                  } else if (ev.key === "Escape") {
                    this.setState({ runtimeNameEditBuffer: "" });
                  }
                }}
              />
              <Button
                compact
                style={{ width: 30, marginLeft: 3 }}
                onClick={() => this.setState({ runtimeNameEditBuffer: "" })}
                icon="close"
              />
              <Button
                compact
                style={{ width: 30 }}
                disabled={runtimeNameEditBuffer === name}
                onClick={() => {
                  this.props.boardContext.setRuntimeName(
                    runtimeId,
                    runtimeNameEditBuffer
                  );
                  this.setState({ runtimeNameEditBuffer: "" });
                }}
                icon="check"
              />
            </div>
          ) : (
            <div style={{ cursor: "pointer" }} title={runtimeId}>
              {name}
              <Icon
                style={s(t.m(5, 0))}
                name="pencil"
                color="grey"
                size="small"
              />
            </div>
          )}
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
          /*runtime.type !== 'browser' && */ <Menu.Item
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
    runtime: RuntimeDescriptor,
    expanded: boolean,
    userId: string,
    boardName: string,
    services: Array<ServiceDescriptor>,
    readonly: boolean,
    registry: ServiceRegistry,
    onArrangeService: (serviceUuid: string, position: number) => void
  ) => {
    const { wrapServices } = this.state;
    if (expanded) {
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
            onRef={(impl) => (this.impl = impl)}
            userId={userId}
            boardName={boardName}
            runtime={runtime}
            services={services}
            readonly={readonly}
            registry={registry}
            onArrangeService={onArrangeService}
            onServiceAction={this.onServiceAction}
          />
          {services?.length === 0 && this.renderEmptyRuntimePlaceholder()}
        </div>
      );
    }
    return false;
  };

  renderBrowserRuntime = (
    runtime: RuntimeDescriptor,
    expanded: boolean,
    userId: string,
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
          ref={(rt) => (this.impl = rt)}
          collapsed={!expanded}
          userId={userId}
          boardName={boardName}
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
    const userId =
      boardContext && boardContext.user && boardContext.user.userId;
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

    if (headless && runtime) {
      return this.renderBrowserRuntime(
        runtime,
        expanded,
        userId,
        boardName,
        services,
        readonly,
        onArrangeService
      );
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
            {
              runtime && runtime.type === "remote"
                ? this.renderRemoteRuntime(
                    runtime,
                    expanded,
                    userId,
                    boardName,
                    services,
                    readonly,
                    registry,
                    onArrangeService
                  )
                : runtime.type === "browser"
                ? this.renderBrowserRuntime(
                    runtime,
                    expanded,
                    userId,
                    boardName,
                    services,
                    readonly,
                    onArrangeService,
                    wrapServices
                  )
                : null
              /*runtime.type === "node"
              ? this.renderNodeRuntime(
                  runtime,
                  expanded,
                  userId,
                  boardName,
                  services,
                  readonly,
                  registry,
                  onArrangeService
                ) : null
              :*/
            }
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
