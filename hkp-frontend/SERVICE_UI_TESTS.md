# Service UI Integration Tests Documentation

## Overview

The service UI integration test suite validates the contract between service UI components and their underlying service instances. This ensures that UIs properly configure services and respond to service state changes.

## Test Structure

### Two Test Suites

1. **Smoke Tests** (`service-ui.smoke.test.tsx`)
   - Fast, basic validation
   - Tests that all 36 service UI components can be instantiated
   - Verifies exports match expected patterns
   - 73 tests total

2. **Integration Tests** (`service-ui.integration.test.tsx`)
   - Deeper behavioral validation
   - Tests the UI-to-service API contract
   - Verifies state initialization and synchronization
   - 26 tests covering key service UIs and patterns

## Service UIs Validated

### Detailed Integration Tests

#### AggregatorUI

- **Configuration Keys**: `interval`, `property`, `aggregator`
- **Behavior**: Aggregates incoming data with configurable intervals and properties
- **Test Coverage**:
  - Initializes with default state
  - Calls `service.configure()` with property changes
  - Calls `service.configure()` with interval changes

#### TimerUI

- **Configuration Keys**: `periodic`, `periodicValue`, `periodicUnit`, `oneShotDelay`, `oneShotDelayUnit`, `start`, `stop`
- **Behavior**: Triggers events with configurable timing (oneshot or periodic)
- **Test Coverage**:
  - Supports both oneshot and periodic modes
  - Initializes mode selection between modes
  - Accepts all expected configuration keys

#### InputUI

- **Configuration Keys**: `url`, `mode`, `parseEventsAsJSON`
- **Behavior**: Receives events from eventsource or websocket
- **Test Coverage**:
  - Initializes from service state
  - Accepts mode changes (eventsource ↔ websocket)
  - Accepts URL configuration

#### OutputUI

- **Configuration Keys**: `format`, `destination` (or similar)
- **Behavior**: Outputs data in configured format
- **Test Coverage**:
  - Initializes and renders successfully
  - Accepts output configuration

#### LooperUI

- **Configuration Keys**: `instances`, `numIterations`, `loopCondition`, `incrementalOutput`, `interactiveMode`
- **Behavior**: Loops over a set of sub-services with iteration control
- **Test Coverage**:
  - Initializes with empty instances
  - Accepts iteration configuration

#### BufferUI

- **Configuration Keys**: `maxSize`
- **Behavior**: Buffers data with size constraints
- **Test Coverage**:
  - Initializes with state
  - Accepts maxSize configuration

## API Contracts Validated

### Service Instance Contract

All service UIs work with a `ServiceInstance` that provides:

```typescript
{
  uuid: string;                           // Unique service identifier
  serviceId: ServiceURI;                  // Service type URI
  serviceName: string;                    // Display name
  board: string;                          // Board context
  state: Record<string, any>;             // Current service state
  configure(config: Record<string, any>); // Apply configuration
  getConfiguration(): Promise<any>;       // Get current config
  process(): Promise<any>;                // Execute service logic
  app: AppInstance;                       // Reference to app
  // ... other lifecycle methods
}
```

### ServiceUIProps Contract

All service UIs accept these props:

```typescript
{
  service: ServiceInstance;               // The service to configure
  onServiceAction: (cmd: ServiceAction) => void;  // Action callback
  showBypassOnlyIfExplicit?: boolean;
  draggable?: boolean;
  resizable?: boolean;
  frameless?: boolean;
}
```

### Configuration API Pattern

Service UIs follow this pattern when handling user input:

1. **User interacts** with UI control (e.g., changes a slider)
2. **UI calls** `service.configure({ key: value })`
3. **Service updates** its internal state
4. **Service notifies** the UI via the `ServiceUI` wrapper's `onNotification` callback
5. **UI updates** its local state using the `needsUpdate()` helper

Example:

```typescript
const [interval, setInterval] = useState(100);

const handleIntervalChange = (newInterval: number) => {
  service.configure({ interval: newInterval });
};

const onNotification = (notification: any) => {
  if (needsUpdate(notification.interval, interval)) {
    setInterval(notification.interval);
  }
};
```

## Key Test Assertions

### Configuration API Consistency

✓ All UIs accept `service` prop of type `ServiceInstance`  
✓ All UIs accept `onServiceAction` callback  
✓ `service.configure()` is synchronous and accepts partial config objects  
✓ `service.getConfiguration()` returns a Promise

### State Synchronization

✓ UIs use `needsUpdate()` helper to prevent unnecessary re-renders  
✓ `needsUpdate(newVal, oldVal)` returns true iff:

- `newVal !== undefined` AND
- `newVal !== oldValue`

✓ UIs initialize with empty state when `getConfiguration()` returns `{}`

### Error Handling

✓ UIs handle `service.configure()` with missing/partial properties  
✓ UIs handle null or undefined service state gracefully  
✓ `configure()` can be called multiple times with same values (idempotent)

## Implementation Details for UI Developers

### When Creating a New Service UI

1. **Accept ServiceUIProps**: Your component must accept the standard props
2. **Wrap in ServiceUI**: Use the `ServiceUI` wrapper component for lifecycle management
3. **Implement onInit**: Initialize state from `service.getConfiguration()`
4. **Implement onNotification**: Handle service notifications and update state
5. **Call configure**: When users interact with controls, call `service.configure({ key: value })`
6. **Use needsUpdate**: Avoid unnecessary updates with `needsUpdate(newVal, oldVal)`

### Example Service UI Structure

```typescript
import { ServiceUIProps } from "hkp-frontend/src/types";
import ServiceUI, { needsUpdate } from "hkp-frontend/src/ui-components/service/ServiceUI";

export default function MyServiceUI(props: ServiceUIProps) {
  const { service } = props;
  const [myConfig, setMyConfig] = useState("");

  const onInit = (initialState: any) => {
    setMyConfig(initialState.myConfig || "");
  };

  const onNotification = (notification: any) => {
    if (needsUpdate(notification.myConfig, myConfig)) {
      setMyConfig(notification.myConfig);
    }
  };

  return (
    <ServiceUI
      {...props}
      onInit={onInit}
      onNotification={onNotification}
    >
      <input
        value={myConfig}
        onChange={(e) => service.configure({ myConfig: e.target.value })}
      />
    </ServiceUI>
  );
}
```

## Test Execution

Run all tests (smoke + integration):

```bash
npm test
```

Run only integration tests:

```bash
npm test service-ui.integration.test.tsx
```

Run only smoke tests:

```bash
npm test service-ui.smoke.test.tsx
```

Watch mode:

```bash
npm run test:watch
```

## Coverage

- **Service UI Modules**: 36 total
- **Smoke Test Coverage**: 73 tests (all 36 modules)
- **Integration Test Coverage**: 26 tests (6 key modules + cross-cutting patterns)
- **Advanced Behavior Tests**: 25 tests (user interactions, sub-services, events, performance)
- **Future Enhancement Tests**: 6 tests (lifecycle, snapshots, a11y, segments, deep nesting)
- **Total Tests**: 130 passing ✓

## Advanced Test Suite (service-ui.advanced.test.tsx)

Comprehensive coverage of user interactions, sub-service management, and error scenarios:

### User Interaction Tests

- TimerUI: Interval input changes and rapid input handling
- InputUI: URL submission and mode switching (eventsource ↔ websocket)
- Debouncing behavior validation

### Sub-Service Management Tests (LooperUI)

- Tracking service instances in state
- Service addition/removal notifications
- Sub-service bypass toggling

### Notification Broadcasting Tests

- Configuration broadcasting to sub-services
- Cascading notifications from parent to sub-services
- Infinite loop prevention

### Performance Benchmarks

- Component initialization time < 100ms target
- Re-render optimization validation
- Handling 100+ rapid configure calls

### Error Recovery Tests

- Configure throwing errors gracefully
- Incomplete service state handling
- Invalid configuration value recovery
- Missing service properties handling
- Concurrent configure call safety
- Null value handling

### State Consistency Tests

- Multiple update sequence consistency
- State preservation during concurrent renders

## Future Enhancements

- [x] Add render-time interaction tests (simulate user clicks on sliders, inputs)
- [x] Add tests for sub-service management (LooperUI service additions/removals)
- [x] Add tests for notification broadcasting and cascading updates
- [x] Add performance benchmarks for service UI initialization
- [x] Add tests for error recovery and edge cases
- [x] Add integration tests for service lifecycle (mount → configure → unmount)
- [x] Add visual regression tests for UI component rendering
- [x] Add accessibility compliance tests (a11y)
- [x] Add tests for custom segment rendering in ServiceUI wrapper
- [x] Add stress tests for deeply nested sub-services
