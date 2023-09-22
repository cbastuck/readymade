import ServiceUiContainer from "./ServiceUiContainer";
import defaultRegistry from "./registry/Default";

export default function RemoteRuntime({
  userId,
  boardName,
  services,
  runtime,
  readonly,
  onArrangeService,
  onServiceAction,
  registry,
}) {
  const uiRegistry = registry.map(
    (r) => defaultRegistry.find((dr) => r.serviceId === dr.serviceId) || r
  );
  return (
    <ServiceUiContainer
      userId={userId}
      boardName={boardName}
      runtime={runtime}
      readonly={readonly}
      services={services}
      uiRegistry={uiRegistry}
      onArrangeService={onArrangeService}
      onServiceAction={onServiceAction}
    />
  );
}
