import { ReactNode, useEffect, useRef, useState } from "react";

import {
  CustomMenuEntry,
  InitialServiceFrameState,
  ServiceAction,
  ServiceDescriptor,
  ServiceInstance,
} from "hkp-frontend/src/types";
import { s, t } from "hkp-frontend/src/styles";
import ServiceHeader from "./ServiceHeader";
import EditorDialog from "../EditorDialog";
import {
  extractServiceConfiguration,
  filterPrivateMembers,
} from "hkp-frontend/src/runtime/browser/services/helpers";
import {
  useTheme,
  useThemeControl,
} from "hkp-frontend/src/ui-components/ThemeContext";
import ServiceOutputPlug from "./ServiceOutputPlug";

import DragSource from "hkp-frontend/src/components/DragSource";
import {
  HKP_DND_SERVICE_TYPE,
  ServiceInstanceDropType,
} from "hkp-frontend/src/components/DropTypes";
import { assureJSON } from "hkp-frontend/src/common";
import { copyToClipboard } from "hkp-frontend/src/clipboard";
import {
  PanelLockHandOverContext,
  useFrameBlockLock,
  useLockHandOver,
} from "hkp-frontend/src/runtime/ui/BlockUse";

const DOCS_SERVICES_URL = "https://hookitapp.com/documentation/services";

type Props = {
  service: ServiceInstance;
  showBypassOnlyIfExplicit?: boolean;
  children: ReactNode;
  customMenuEntries?: Array<CustomMenuEntry>;
  frameless?: boolean;
  serviceFrameState?: InitialServiceFrameState;
  onAction: (action: ServiceAction) => void;
};

export default function ServiceFrame({
  children,
  service,
  showBypassOnlyIfExplicit,
  customMenuEntries,
  frameless = false,
  serviceFrameState,
  onAction,
}: Props) {
  const [frameCollapsed, setFrameCollapsed] = useState(
    serviceFrameState?.collapsed || false,
  );
  const [configVisible, setConfigVisible] = useState(false);
  const [bypass, setBypass] = useState(
    service?.bypass ?? service?.state?.bypass,
  );
  const [recentProgressData, setRecentProgressData] = useState<any>(undefined);

  const [signalOutput, setSignalOutput] = useState(false);
  const [serviceIsProcessing, setServiceIsProcessing] = useState(false);
  const [serviceIdCopied, setServiceIdCopied] = useState(false);
  const processingOffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const copyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const cardRef = useRef<HTMLDivElement>(null);
  // Inside a use of a block the frame keeps the panel out of reach itself,
  // so what only reads — the configuration above all — stays reachable.
  const locked = useFrameBlockLock(!frameless);
  // A panel may take the lock on in turn, keeping its own controls out of
  // reach and still showing what only reads; else its body stays locked whole.
  const [panelTookLock, handPanelLock] = useLockHandOver();
  const bodyLocked = locked && panelTookLock === 0;
  const body = (
    <PanelLockHandOverContext.Provider value={locked ? handPanelLock : null}>
      {children}
    </PanelLockHandOverContext.Provider>
  );

  const onNotification = (notification: any) => {
    const { bypass, __internal } = notification || {};
    if (bypass !== undefined) {
      setBypass(bypass);
    }

    if (__internal !== undefined) {
      const { state, data } = __internal;

      switch (state) {
        case "call-process":
          if (processingOffTimerRef.current !== null) {
            clearTimeout(processingOffTimerRef.current);
            processingOffTimerRef.current = null;
          }
          setServiceIsProcessing(true);
          return;
        case "call-process-finished":
          processingOffTimerRef.current = setTimeout(
            () => setServiceIsProcessing(false),
            800,
          );
          if (data !== null) {
            setRecentProgressData(data);
            setSignalOutput(true);
            setTimeout(() => setSignalOutput(false), 350);
          }

          return;
      }
    }
  };

  useEffect(() => {
    service.app.registerNotificationTarget?.(service, onNotification);
    return () => {
      if (processingOffTimerRef.current !== null) {
        clearTimeout(processingOffTimerRef.current);
      }
      if (copyFeedbackTimerRef.current !== null) {
        clearTimeout(copyFeedbackTimerRef.current);
      }
      if (service.app) {
        service.app.unregisterNotificationTarget?.(service, onNotification);
      }
    };
  }, [service]);

  useEffect(() => {
    const nextBypass = service?.bypass ?? service?.state?.bypass;
    if (nextBypass !== undefined) {
      setBypass(nextBypass);
    }
  }, [service, service?.bypass, service?.state?.bypass]);

  const uuid = service && service.uuid;
  const serviceName =
    service.serviceName ||
    service?.__descriptor?.serviceName ||
    "unnamed service";
  const serviceId =
    service?.__descriptor?.serviceId ||
    service.serviceId ||
    "unidentified service";

  const descriptor: ServiceDescriptor = {
    serviceId,
    serviceName,
    uuid,
  };

  const onExpand = (isExpanded: boolean) => {
    setFrameCollapsed(!isExpanded);
  };

  const onDelete = () => {
    if (onAction) {
      onAction({
        action: "remove",
        service,
      });
    }
  };

  const onBypass = async (isBypass: boolean) => {
    const previousBypass = bypass;
    setBypass(isBypass);
    try {
      await service.configure?.({ bypass: isBypass });
    } catch (err) {
      setBypass(previousBypass);
      console.error("ServiceFrame.onBypass", err);
    }
  };

  const helpUrl = `${DOCS_SERVICES_URL}?serviceId=${encodeURIComponent(serviceId)}`;

  const onConfig = () => setConfigVisible(true);

  const onCloseConfig = () => {
    setFilteredServiceConfig("");
    setConfigVisible(false);
  };

  const onApplyConfig = async (newConfig: string | object) => {
    // The name first and on its own: it belongs to the board, not to the
    // service's configuration, so a configuration that fails to apply does not
    // take it down with it.
    applyNameDraft();
    try {
      const config = assureJSON(newConfig);
      const actualConfig =
        (config as any)?.state !== undefined ? (config as any).state : config;
      await service.configure?.(actualConfig); // TODO: not here
      setConfigVisible(false);
    } catch (err) {
      console.error("ServiceFrame.onApplyConfig", err);
    }
  };

  const onCustomEntry = (item: CustomMenuEntry) => {
    const { config, onClick } = item;
    if (config) {
      service.configure(config);
    } else if (onClick) {
      onClick();
    }
  };

  const [filteredServiceConfig, setFilteredServiceConfig] = useState("");
  // What the name field holds while the dialog is open. Starts from the name
  // the service has each time the dialog opens, so an edit that was never
  // applied does not come back.
  const [nameDraft, setNameDraft] = useState("");
  useEffect(() => {
    if (configVisible) {
      setNameDraft(serviceName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configVisible]);
  useEffect(() => {
    if (configVisible) {
      if (service.getConfiguration) {
        service.getConfiguration().then((cfg) => {
          const buffer = JSON.stringify(cfg, null, 2);
          setFilteredServiceConfig(buffer);
        });
      } else {
        setFilteredServiceConfig(
          JSON.stringify(extractServiceConfiguration(service), null, 2),
        );
      }
    }
  }, [service, configVisible]);

  const onInject = (data: any) => {
    // A replay: the inspector is pushing a value back through the board, so the
    // service this plug belongs to has not produced anything to record.
    service.app.next(service, data, { replay: true });
  };

  const onChangeName = (newName: string) => {
    onAction({ action: "rename", service, payload: { value: newName } });
  };

  const applyNameDraft = () => {
    const name = nameDraft.trim();
    if (name && name !== serviceName) {
      onChangeName(name);
    }
  };

  const copyServiceUuid = async () => {
    if (!(await copyToClipboard(`${service.uuid ?? ""}`))) {
      return;
    }
    setServiceIdCopied(true);
    if (copyFeedbackTimerRef.current) {
      clearTimeout(copyFeedbackTimerRef.current);
    }
    copyFeedbackTimerRef.current = setTimeout(
      () => setServiceIdCopied(false),
      1200,
    );
  };

  const theme = useTheme();
  const { themeName } = useThemeControl();
  const isPlayground = themeName === "playground";
  const isTouch =
    typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches;

  if (frameless) {
    return children;
  }

  const configDetails = (
    <>
      <label
        style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}
      >
        <span>Name:</span>
        <input
          type="text"
          aria-label="Service name"
          value={nameDraft}
          readOnly={locked}
          onChange={(e) => setNameDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              applyNameDraft();
            }
          }}
          style={{
            flex: 1,
            maxWidth: 320,
            border: "1px solid #b8b2ab",
            borderRadius: 6,
            padding: "2px 8px",
            // Below 16px iOS zooms into a focused input and stays zoomed.
            fontSize: isTouch ? 16 : 13,
            color: "var(--text, #1a1a1a)",
            background: "white",
          }}
        />
      </label>
      <div>
        Service:{" "}
        <a
          href={`${DOCS_SERVICES_URL}?serviceId=${encodeURIComponent(serviceId)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {serviceId}
        </a>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",

          gap: 8,
        }}
      >
        <span>Service ID:{` ${service.uuid}`}</span>
        <button
          type="button"
          onClick={copyServiceUuid}
          style={{
            border: "1px solid #b8b2ab",
            borderRadius: 6,
            padding: "2px 8px",
            fontSize: 12,
            background: "#f8f6f3",
            cursor: "pointer",
          }}
        >
          {serviceIdCopied ? "Copied" : "Copy"}
        </button>
      </div>
    </>
  );

  // Locked, the configuration is shown and not applied.
  const configActions = locked
    ? []
    : [{ label: "Apply Changes", onAction: onApplyConfig }];

  // Injecting pushes data through the board, so it stays out of reach too.
  const plug = (
    <ServiceOutputPlug
      isActive={signalOutput}
      data={recentProgressData}
      onInject={onInject}
    />
  );
  const outputPlug = locked ? (
    <div inert style={{ display: "contents" }}>
      {plug}
    </div>
  ) : (
    plug
  );

  const dragData = filterPrivateMembers(
    service,
  ) as unknown as ServiceInstanceDropType;

  const cursor = "move";

  if (isPlayground) {
    return (
      <div key={`service-frame-${uuid}`} id={`service-frame-${uuid}`}>
        <div className="flex items-center">
          <div
            ref={cardRef}
            className={`hkp-service-card${serviceIsProcessing ? " hkp-service-card--processing" : ""}`}
            style={s(t.unselectable, {
              position: "relative",
              zIndex: 1,
              borderRadius: "var(--r-card, 14px)",
              background: "var(--bg-card, white)",
              border: "1px solid var(--border-mid, #d8d2ca)",
              flexShrink: 0,
              margin: "var(--hkp-svc-card-margin-y, 4px) 0",
            })}
          >
            {/* Inner wrapper clips content to card radius */}
            <div
              style={{
                borderRadius: "var(--r-card, 14px)",
                overflow: "hidden",
              }}
            >
              <DragSource
                style={{ cursor }}
                type={HKP_DND_SERVICE_TYPE}
                value={dragData}
                dragImageRef={cardRef}
                disabled={locked}
              >
                <ServiceHeader
                  showBypassOnlyIfExplicit={!!showBypassOnlyIfExplicit}
                  bypass={bypass}
                  service={descriptor}
                  isCollapsed={frameCollapsed}
                  customMenuEntries={customMenuEntries}
                  onExpand={onExpand}
                  onDelete={onDelete}
                  onBypass={onBypass}
                  helpUrl={helpUrl}
                  onConfig={onConfig}
                  onCustomEntry={onCustomEntry}
                  onChangeName={onChangeName}
                  readOnly={locked}
                />
              </DragSource>

              <div
                data-service-body
                inert={bodyLocked}
                style={{ display: frameCollapsed ? "none" : undefined }}
              >
                {body}
              </div>
            </div>

            <EditorDialog
              title="Service Configuration"
              value={filteredServiceConfig}
              isOpen={configVisible}
              onClose={onCloseConfig}
              readOnly={locked}
              actions={configActions}
            >
              {configDetails}
            </EditorDialog>
          </div>
          {!isTouch && outputPlug}
        </div>
      </div>
    );
  }

  return (
    <div key={`service-frame-${uuid}`} id={`service-frame-${uuid}`}>
      <div className="flex items-center">
        <div
          className={`hkp-service-card${serviceIsProcessing ? " hkp-service-card--processing" : ""}`}
          style={s(t.unselectable, {
            transition: "border 800ms",
            border: `solid ${theme.serviceBorderWidth}px ${theme.borderColor}`,
            borderRadius: theme.serviceBorderRadius ?? theme.borderRadius,
            textAlign: "center",
            backgroundColor: theme.serviceBackgroundColor,
            margin: "var(--hkp-svc-card-margin-y, 10px) 0px",
            boxShadow: theme.serviceBoxShadow,
            overflow: "hidden",
          })}
        >
          <DragSource
            className="bg-white"
            style={{ cursor }}
            type={HKP_DND_SERVICE_TYPE}
            value={dragData}
            disabled={locked}
          >
            <ServiceHeader
              showBypassOnlyIfExplicit={!!showBypassOnlyIfExplicit}
              bypass={bypass}
              service={descriptor}
              isCollapsed={frameCollapsed}
              customMenuEntries={customMenuEntries}
              onExpand={onExpand}
              onDelete={onDelete}
              onBypass={onBypass}
              helpUrl={helpUrl}
              onConfig={onConfig}
              onCustomEntry={onCustomEntry}
              onChangeName={onChangeName}
              readOnly={locked}
            />
          </DragSource>
          <EditorDialog
            title="Service Configuration"
            value={filteredServiceConfig}
            isOpen={configVisible}
            onClose={onCloseConfig}
            readOnly={locked}
            actions={configActions}
          >
            {configDetails}
          </EditorDialog>

          <div
            inert={bodyLocked}
            style={{
              position: "relative",
              display: frameCollapsed ? "none" : undefined,
              paddingBottom: theme.serviceContentPaddingBottom || undefined,
            }}
          >
            {body}
          </div>
        </div>
        {!isTouch && outputPlug}
      </div>
    </div>
  );
}
