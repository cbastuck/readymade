import { Component, ReactElement } from "react";
import { Icon, Menu, Header } from "semantic-ui-react";

import Modal from "./Modal";
import ServiceReference from "./ServiceReference";
import ConfigurationEditor from "./ConfigurationEditor";
import { s, t } from "../styles";
import { filterPrivateMembers } from "../runtime/browser/services/helpers";
import { ServiceAction, InstanceId, ServiceImpl } from "../types";

function getNotificationID(service: InstanceId) {
  return `service-frame-${service.uuid}`;
}

type Props = {
  service: ServiceImpl;
  serviceUi: ReactElement | null;
  draggable: boolean;
  showBypassOnlyIfExplicit?: boolean;

  onAction: (action: ServiceAction) => void;
};

type State = {
  menuVisible: boolean;
  frameCollapsed: boolean;
  modalReferenceService: string | undefined;
  configVisible: boolean;
  bypass: boolean | undefined;
};

export default class ServiceFrame extends Component<Props, State> {
  state = {
    menuVisible: false,
    frameCollapsed: false,
    modalReferenceService: undefined,
    configVisible: false,
    bypass: undefined,
  };

  componentDidMount() {
    const { service } = this.props;
    service.__notificationTargets?.register(
      getNotificationID(service),
      (_, notification) => {
        const { bypass } = notification || {};
        if (bypass !== undefined) {
          this.setState({ bypass });
        }
      }
    );
  }

  componentWillUnmount() {
    const { service } = this.props;
    service.__notificationTargets?.unregister(getNotificationID(service));
  }

  renderServiceName = (name: string) => {
    const { draggable = true, service } = this.props;
    return (
      <div
        style={{
          textAlign: "center",
          width: "100%",
          fontSize: 16,
          fontWeight: "lighter",
          marginTop: 15,
          cursor: draggable ? "pointer" : undefined,
        }}
        onDoubleClick={() =>
          this.setState({ frameCollapsed: !this.state.frameCollapsed })
        }
        draggable={draggable}
        onDragStart={(ev) => {
          const { service } = this.props;
          const publicService = filterPrivateMembers(service);
          ev.dataTransfer.setData("text/plain", JSON.stringify(publicService));
        }}
      >
        <Header size="small" className="hkp-fnt-family">
          <span
            style={{
              fontSize: 12,
              letterSpacing: 1.5,
              whiteSpace: "nowrap",
            }}
            title={service.uuid}
          >
            {name}
          </span>
        </Header>
      </div>
    );
  };

  renderHeader = (service: ServiceImpl) => {
    const { bypass = service ? service.bypass : undefined } = this.state;
    const serviceName =
      service?.__descriptor?.serviceName ||
      service.serviceName ||
      "unnamed service";
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "row",
        }}
      >
        {(!this.props.showBypassOnlyIfExplicit || bypass !== undefined) && (
          <div style={t.p(15, 13)}>
            <Icon
              style={{
                cursor: "pointer",
                opacity: 0.5,
              }}
              name="power off"
              color={bypass ? "red" : "grey"}
              onClick={() => service.configure({ bypass: !bypass })}
            />
          </div>
        )}
        <div
          style={{
            flexGrow: 2,
            textAlign: "center",
          }}
        >
          {this.renderServiceName(serviceName)}
        </div>
        <Menu
          borderless={true}
          style={{
            boxShadow: "none",
            border: "none",
            margin: 0,
          }}
        >
          <Menu.Item
            position="right"
            onClick={() =>
              this.setState({
                menuVisible: !this.state.menuVisible,
                frameCollapsed:
                  this.state.frameCollapsed && !this.state.menuVisible,
              })
            }
          >
            <Icon name="bars" style={{ color: "#ddd", margin: 5 }} />
          </Menu.Item>
        </Menu>
      </div>
    );
  };

  renderMenu = () => {
    const itemStyle = {
      height: 40,
    };
    return (
      <Menu vertical compact style={{ minHeight: "100%" }}>
        <Menu.Item
          as="a"
          onClick={() =>
            this.setState({
              frameCollapsed: !this.state.frameCollapsed,
              menuVisible: false,
            })
          }
          style={itemStyle}
        >
          <Icon name="compress" />
        </Menu.Item>
        {/*
        <Menu.Item
          as='a'
          style={itemStyle}
        >
          <Icon name='clone outline' />
        </Menu.Item>
        */}
        <Menu.Item
          as="a"
          style={itemStyle}
          onClick={() => {
            const { onAction, service } = this.props;
            if (onAction) {
              onAction({
                action: "remove",
                service,
              });
            }
            this.setState({ menuVisible: false });
          }}
        >
          <Icon name="trash alternate outline" />
        </Menu.Item>
        <Menu.Item
          as="a"
          style={itemStyle}
          onClick={() => {
            const { service } = this.props;
            const serviceId =
              service.serviceId || service.__descriptor?.serviceId;
            const parts = serviceId?.split("/") || [];
            if (parts.length > 1) {
              this.setState({
                modalReferenceService: parts[parts.length - 1],
                menuVisible: false,
              });
            }
          }}
        >
          <Icon name="help" />
        </Menu.Item>
        <Menu.Item
          as="a"
          style={itemStyle}
          onClick={() => {
            this.setState({
              configVisible: true,
              menuVisible: false,
            });
          }}
        >
          <Icon name="cogs" />
        </Menu.Item>
      </Menu>
    );
  };

  renderServiceWithSidebar = (
    serviceUi: ReactElement | null,
    menuVisible: boolean
  ) => {
    return (
      <div
        style={{
          position: "relative",
        }}
      >
        {menuVisible && (
          <div
            style={{
              position: "absolute",
              height: "100%",
              width: "100%",
              backgroundColor: "white",
              opacity: 0.8,
              zIndex: 2000001,
            }}
            onClick={() => this.setState({ menuVisible: false })}
          />
        )}
        {serviceUi || <div />}
        <div
          style={{
            position: "absolute",
            height: "100%",
            width: menuVisible ? 59 : 0,
            right: 0,
            top: 0,
            overflowY: "auto",
            overflowX: "hidden",
            zIndex: 2000002,
            transition: "width 0.3s ease",
          }}
        >
          {this.renderMenu()}
        </div>
      </div>
    );
  };

  render() {
    const {
      frameCollapsed,
      modalReferenceService,
      menuVisible,
      configVisible,
    } = this.state;
    const { serviceUi, service } = this.props;
    const uuid = service && service.uuid;
    return (
      <div key={`service-frame-${uuid}`}>
        <div
          style={s(t.unselectable, {
            border: "solid 1px lightgray",
            borderRadius: 5,
            textAlign: "center",
            backgroundColor: "white",
            margin: "10px 0px",
            fontSize: 15,
            color: "black",
          })}
        >
          {this.renderHeader(service)}
          {!frameCollapsed && configVisible && (
            <ConfigurationEditor
              service={service}
              onClose={() => this.setState({ configVisible: false })}
              onChange={async (value: string) => {
                try {
                  const config = JSON.parse(value);
                  await service.configure(config); // TODO: not here
                  this.setState({ configVisible: false });
                } catch (err) {}
              }}
            />
          )}
          {!configVisible &&
            !frameCollapsed &&
            this.renderServiceWithSidebar(serviceUi, menuVisible)}
          <Modal
            title="Service Documentation"
            component={<ServiceReference service={modalReferenceService} />}
            url={`/service/${modalReferenceService}`}
            setOpen={(open) =>
              !open && this.setState({ modalReferenceService: undefined })
            }
            isOpen={!!modalReferenceService}
          />
        </div>
      </div>
    );
  }
}
