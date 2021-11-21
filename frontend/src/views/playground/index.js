import React, { Component } from "react";
import { Button, Loader, Tab } from "semantic-ui-react";
import uuid from "uuid";
import qs from "query-string";

import Editor from "../../components/shared/Editor/index";
import { redirectTo } from "../../core/actions";
import BoardProvider, { BoardConsumer } from "../../BoardContext";
import Toolbar from "../../components/Toolbar";
import Footer from "../../components/Footer";

import { s, t } from "../../styles";
import BrowserRegistry from "../../runtime/BrowserRegistry";
import { filterPrivateMembers } from "../../runtime/services/helpers";

import VSpacer from "../../components/shared/VSpacer";
import BoardCollection from "../../components/BoardCollection";
import EmptySketch from "./EmptySketch";
import Board from "./Board";

import { replacePlaceholders } from "../../core/url";
import { generateRandomName } from "../../core/board";

const defaultBundles = [
  "hookup.to/registry/browser/Audio",
  "hookup.to/registry/browser/Graphic",
  "hookup.to/registry/browser/FileStorage",
];

const allowedServices = [
  "hookup.to/service/timer",
  "hookup.to/service/monitor",
  "hookup.to/service/canvas",
  "hookup.to/service/map",
  "hookup.to/service/filter",
  "hookup.to/service/camera",
  "hookup.to/service/injector",
  "hookup.to/service/trigger-pad",
  "hookup.to/service/sound",
  "hookup.to/service/audio-output",
  "hookup.to/service/audio-input",
  "hookup.to/service/gif-encoder",
  "hookup.to/service/input",
  "hookup.to/service/output",
  "hookup.to/service/thrower",
  "hookup.to/service/receiver",
  "hookup.to/service/downloader",
  "hookup.to/service/mp3encoder",
  "hookup.to/service/reduce",
  "hookup.to/service/chart",
  "hookup.to/service/spotify",
  "hookup.to/service/github-source",
  "hookup.to/service/github-sink",
  "hookup.to/service/cache",
  "hookup.to/service/key-handler",
  "hookup.to/service/reactor",
];

//const usecasesUrl = 'https://raw.githubusercontent.com/cbastuck/hkp/master/usecases/index.json';
const usecasesUrl = "/boards/usecases/index.json";
const defaultName = "Playground";

function getSavedBoards() {
  const savedBoards = [];
  const prefix = "hkp-playground-";
  for (const key in localStorage) {
    if (key.startsWith(prefix)) {
      savedBoards.push({
        name: key.substr(prefix.length),
        value: JSON.parse(localStorage.getItem(key)),
      });
    }
  }
  return savedBoards;
}

export default class Playground extends Component {
  state = {
    boardName:
      (this.props.match &&
        this.props.match.params &&
        this.props.match.params.board) ||
      defaultName,
    showRoutingOptions: false,
    sidechainRouting: {},
    placeholderAnimationRunning: false,
    runtimes: undefined,
    services: undefined,
    description: "",
    initialFetched: false,
    savedBoards: getSavedBoards(),
    inputRouting: {},
    outputRouting: {},
    initialTabLocation: "#usecase",
  };

  user = {
    username: "Anonymous",
    userId: undefined,
  };

  availableRuntimes = [{ name: "browser", args: "browser" }];

  externalInputs = {};

  componentDidMount() {
    const { hash } = window && window.location;
    this.setState({ initialTabLocation: hash || "#usecase" });
  }

  componentDidUpdate(prevProps) {
    const board = this.props.match.params.board;
    const prevBoard = prevProps.match.params.board;
    if (board !== prevBoard) {
      if (board === undefined) {
        this.setState({
          boardName: defaultName,
          runtimes: undefined,
          services: undefined,
          sidechainRouting: {},
          description: "",
          initialFetched: false,
          outputRouting: {},
          inputRouting: {},
        });
      } else {
        this.setState({
          boardName: board,
          initialFetched: false,
        });
      }
    }
  }

  componentWillUnmount() {
    this.clearPlayground();
  }

  fetchData = async () => {
    const {
      boardName = defaultName,
      runtimes = [],
      services = {},
      description = "",
      sidechainRouting = {},
      outputRouting = {},
      inputRouting = {},
    } = this.state.initialFetched
      ? this.state
      : await this.setInitialPlayground();

    if (!this.defaultRegistry) {
      this.defaultRegistry = await BrowserRegistry.create(defaultBundles);
    }

    const data = {
      board: { name: boardName },
      runtimes,
      services,
      registry:
        runtimes &&
        runtimes.reduce(
          (all, rt) => ({
            ...all,
            [rt.id]: this.defaultRegistry.availableServices,
          }),
          {}
        ),
      sidechainRouting,
      outputRouting,
      inputRouting,
    };
    this.setState({
      ...data,
      initialFetched: true,
      description,
    });
    return data;
  };

  setInitialPlayground = () => {
    const queryParams = new URLSearchParams(document.location.search);
    const { board } = this.props.match.params;
    if (board) {
      const params = qs.parse(document.location.search);
      if (params.template) {
        return this.createBoardFromTemplate(params.template, params);
      } else {
        const localBoard = this.restoreBoardFromLocalStorage(board);
        if (localBoard) {
          return localBoard;
        }
        return this.state; // use initial state
      }
    }

    const src = queryParams.get("src");
    if (src) {
      return this.importBoard(src);
    }

    return {};
  };

  importBoard = async (url) => {
    try {
      const res = await fetch(url);
      const data = await res.json();
      const runtimeIds = Object.keys(data);
      return {
        runtimes: runtimeIds.map((rid, ridx) => ({
          id: rid,
          type: data[rid].type,
          name: data[rid].name || `Runtime ${ridx + 1}`,
        })),
        services: runtimeIds.reduce(
          (all, rid) => ({
            ...all,
            [rid]: data[rid].services.map((svc) => {
              if (!svc.uuid) {
                return { ...svc, uuid: uuid.v4() };
              }
              return svc;
            }),
          }),
          {}
        ),
      };
    } catch (err) {
      console.log("Import failed", err, url);
    }
  };

  createBoardFromTemplate = async (templateUrl, params) => {
    const resp = await fetch(templateUrl);
    if (resp && resp.ok) {
      try {
        const template = await resp.json();
        const {
          runtimes,
          services,
          sidechainRouting,
          description,
          inputRouting,
          outputRouting,
        } = template;
        const patchedRuntimes = runtimes.map((rt) => ({
          ...rt,
          id: uuid.v4(),
        }));
        const patchedServices = patchedRuntimes.reduce(
          (all, rt, idx) => ({
            ...all,
            [rt.id]: services[runtimes[idx].id].map((svc) => ({
              uuid: uuid.v4(),
              ...svc,
            })),
          }),
          {}
        );
        return {
          runtimes: patchedRuntimes,
          services: patchedServices,
          sidechainRouting: sidechainRouting
            ? patchedRuntimes.reduce((all, rt, idx) => {
                const originalRt = runtimes[idx];
                const originalRuntimeSidechain =
                  sidechainRouting[originalRt.id] || [];
                const patchedRuntimeSidechain = originalRuntimeSidechain.map(
                  (entry) => {
                    const origRTIndex = runtimes.findIndex(
                      (r) => r.id === entry.runtimeId
                    );
                    if (origRTIndex === -1) {
                      console.error(
                        "createBoardFromTemplate(): could not find runtime",
                        entry,
                        runtimes
                      );
                    }
                    const origSvcIndex = services[entry.runtimeId].findIndex(
                      (svc) => svc.uuid === entry.serviceUuid
                    );
                    if (origSvcIndex === -1) {
                      console.error(
                        "createBoardFromTemplate(): could not find service",
                        entry,
                        services[originalRt.id]
                      );
                    }
                    const patchedRuntimeId = patchedRuntimes[origRTIndex].id;
                    return {
                      runtimeId: patchedRuntimeId,
                      serviceUuid:
                        patchedServices[patchedRuntimeId][origSvcIndex].uuid,
                    };
                  }
                );
                return {
                  ...all,
                  [rt.id]: patchedRuntimeSidechain,
                };
              }, {})
            : {},
          inputRouting: inputRouting
            ? patchedRuntimes.reduce(
                (all, rt, idx) => ({
                  ...all,
                  [rt.id]: replacePlaceholders(
                    inputRouting[runtimes[idx].id],
                    params
                  ),
                }),
                {}
              )
            : undefined,
          outputRouting: outputRouting
            ? patchedRuntimes.reduce((all, rt, idx) => {
                const routing = outputRouting[runtimes[idx].id];
                return routing
                  ? {
                      ...all,
                      [rt.id]: {
                        ...routing,
                        peer: replacePlaceholders(routing.peer, params),
                      },
                    }
                  : all;
              }, {})
            : undefined,
          description,
        };
      } catch (err) {
        console.error("Creating from template failed", templateUrl, err);
      }
    }
  };

  restoreBoardFromLocalStorage = (name) => {
    const storageName = name ? `hkp-playground-${name}` : "hkp-playground";
    const data = localStorage.getItem(storageName);
    if (data) {
      return JSON.parse(data);
    }
  };

  storeBoard = (name, description) => {
    const {
      runtimes = [],
      services = {},
      sidechainRouting = {},
      outputRouting = {},
      inputRouting = {},
    } = this.state;
    const data = {
      runtimes: runtimes.map((rt) => ({
        id: rt.id,
        name: rt.name,
        type: rt.type,
      })),
      services: Object.keys(services).reduce((all, runtimeId) => {
        const rt = this.board.getRuntimeById(runtimeId);
        return {
          ...all,
          [runtimeId]: services[runtimeId].map((s) => ({
            ...filterPrivateMembers(rt.getServiceById(s.uuid)),
            serviceId: s.serviceId,
            serviceName: s.serviceName,
          })),
        };
      }, {}),
      sidechainRouting,
      outputRouting,
      inputRouting,
      description,
    };
    localStorage.setItem(`hkp-playground-${name}`, JSON.stringify(data));
  };

  newBoard = () => {
    const name = generateRandomName();
    redirectTo(`/playground/${name}`);
  };

  addService = (boardName, descriptor, runtimeId) => {
    const { services = {} } = this.state;
    const runtime = this.board.getRuntimeById(runtimeId);
    if (!runtime) {
      return;
    }
    const svc = {
      ...descriptor,
      uuid: uuid.v4(),
    };
    this.setState({
      services: {
        ...services,
        [runtimeId]: [...services[runtimeId], svc],
      },
    });
    return svc;
  };

  removeService = async (boardName, runtimeId, service) => {
    const { services = {} } = this.state;
    const runtime = this.board && this.board.getRuntimeById(runtimeId);
    if (!runtime) {
      return;
    }

    await runtime.destroyService(service.uuid);

    const runtimeServices = services[runtimeId];
    const updatedServices = runtimeServices.filter(
      (svc) => svc.uuid !== service.uuid
    );
    this.setState({
      services: {
        ...services,
        [runtimeId]: updatedServices,
      },
    });
  };

  addRuntime = async (boardname, desc) => {
    const { runtimes = [], services = {} } = this.state;
    const runtimeId = uuid.v4();
    const rt = {
      id: runtimeId,
      name: `Runtime-${runtimes ? runtimes.length + 1 : 1}`,
      type: "browser",
    };
    this.setState({
      runtimes: runtimes.concat(rt),
      services: {
        ...services,
        [runtimeId]: [],
      },
    });
  };

  destroyRuntime = (runtime) => {
    const externalInput = this.externalInputs[runtime.id];
    if (externalInput) {
      externalInput.close();
      delete this.externalInputs[runtime.id];
    }

    const rt = this.board && this.board.getRuntimeById(runtime.id);
    if (!rt) {
      return;
    }

    return rt.destroyRuntime();
  };

  removeRuntime = async (runtime) => {
    await this.destroyRuntime(runtime);

    const { runtimes = [], services = {} } = this.state;
    const updatedRuntimes = runtimes.filter((r) => r.id !== runtime.id);
    const updatedServices = Object.keys(services)
      .filter((r) => r.id !== runtime.id)
      .reduce((all, key) => ({ ...all, [key]: services[key] }), {});
    this.setState({
      runtimes: updatedRuntimes,
      services: updatedServices,
    });
  };

  clearPlayground = async () => {
    const { runtimes = [] } = this.state;
    for (const runtime of runtimes) {
      await this.destroyRuntime(runtime);
    }

    for (const ext of Object.keys(this.externalInputs)) {
      this.externalInputs[ext].close();
    }
    this.externalInputs = [];
    this.setState({ services: {}, runtimes: [] });
  };

  arrangeService = (runtime, serviceUuid, targetPosition) => {
    const { services: allServices } = this.state;
    const services = allServices[runtime.id];

    const service = services.find((svc) => serviceUuid === svc.uuid);
    const oldPosition = services.indexOf(service);
    const rearranged = services.filter((svc) => serviceUuid !== svc.uuid);
    const offset = targetPosition < oldPosition ? 0 : 1;
    rearranged.splice(targetPosition - offset, 0, service);
    this.setState({
      services: {
        ...allServices,
        [runtime.id]: rearranged,
      },
    });
  };

  setRuntimeName = (runtimeId, newName) => {
    this.setState({
      runtimes: this.state.runtimes.map((rt) =>
        rt.id === runtimeId ? { ...rt, name: newName } : rt
      ),
    });
  };

  saveBoard = async () => {
    if (this.prompt) {
      const suggested =
        this.props.match && this.props.match.params
          ? this.props.match.params.board
          : generateRandomName();
      const value = await this.prompt.getInput(suggested);
      if (value !== null) {
        const { name, description } = value;
        this.storeBoard(name, description);
        if (name !== suggested) {
          redirectTo(`/playground/${name}`);
        }
      }
    }
  };

  closeSourceView = () => {
    const { pathname } = window.location;
    redirectTo(pathname.split("/").slice(0, -1).join("/"));
  };

  renderUsecases = () => {
    const { usecases } = this.state;
    const internalUsecases = [
      /*{
        name: 'GameInternal',
        url: `/playground/${generateRandomName()}?template=/boards/templates/game.json&${qs.stringify({ 'sender-board': generateRandomName() })}`,
        metadata: 'use case',
        description: 'GAMEMEME'
      }*/
    ];
    if (!usecases) {
      fetch(usecasesUrl)
        .then((resp) => resp.json())
        .then((usecases) =>
          this.setState({
            usecases: internalUsecases.concat(
              usecases.map((item) => ({
                ...item,
                url: replacePlaceholders(
                  `/playground/${generateRandomName()}?template=${
                    item.template
                  }`
                ),
                metadata: "use case",
                repo: item.repo,
              }))
            ),
          })
        );
    }
    return (
      <div style={t.tc}>
        {usecases ? (
          <BoardCollection
            style={{
              width: "100%",
              marginRight: 20,
            }}
            headline="Available Usecases"
            items={usecases}
            renderBorder={false}
          />
        ) : (
          <div>
            <Loader active inline>
              Loading Usecases ...
            </Loader>
          </div>
        )}
      </div>
    );
  };

  renderStoredBoards = (savedBoards) => {
    const items = savedBoards.map((item) => ({
      ...item,
      url: `/playground/${item.name}`,
      description: item.value.description,
    }));
    return (
      items.length > 0 && (
        <div style={s(t.mt20)}>
          <BoardCollection
            style={{ width: "100%", marginRight: 20 }}
            headline="Saved boards in this browser"
            items={items}
            renderBorder={false}
          />
        </div>
      )
    );
  };

  renderPlaceholderOrPlayground = (boardContext) => {
    const { savedBoards = [], boardName, initialTabLocation } = this.state;
    const showLoadPanel = boardName === defaultName;
    const menuItem = (value) => ({
      key: `playgound-tab-item-${value}`,
      content: value,
      style: s(t.uc, t.fs12, t.ls1),
    });
    const isPlaygroundEmpty =
      boardContext &&
      boardContext.runtimes &&
      boardContext.runtimes.length === 0;
    const content = isPlaygroundEmpty ? (
      <EmptySketch defaultName={defaultName} boardName={boardName} />
    ) : (
      this.renderPlayground(boardContext)
    );
    const saveReminder = !isPlaygroundEmpty && (
      <div style={s(t.fs12, t.mb10)}>
        Remember you can
        <span
          style={{ cursor: "help", color: "#4284C4" }}
          onClick={() => {
            const selector = document.getElementById("board-dropdown");
            if (selector) {
              selector.focus();
              selector.click();
            }
          }}
        >
          {" save this board "}
        </span>
        to continue later
      </div>
    );
    const initialIndex = initialTabLocation === "#usecase" ? 1 : 0;
    return (
      <div style={t.fill}>
        <div style={{ width: "99%", margin: "auto" }}>
          {showLoadPanel ? (
            <div style={s(t.uc, t.fs16, t.ls1, t.tc)}>
              <h1
                style={s(t.fs20, {
                  margin: 0,
                  marginTop: showLoadPanel ? 25 : 40,
                })}
              >
                Welcome to Playground
              </h1>
              <h2 style={s(t.fs13, t.m(0, 10))}> Pick an option </h2>
              <Tab
                style={s(t.m(0, 30), t.tc)}
                menu={{ attached: "top", widths: 3, pointing: true }}
                panes={[
                  {
                    menuItem: menuItem("Sketch board"),
                    render: () => (
                      <Tab.Pane>
                        {content} {saveReminder}
                      </Tab.Pane>
                    ),
                  },
                  {
                    menuItem: menuItem("Launch Usecase"),
                    render: () => <Tab.Pane> {this.renderUsecases()}</Tab.Pane>,
                  },
                  {
                    menuItem: menuItem("Restore board"),
                    render: () => (
                      <Tab.Pane>
                        {this.renderStoredBoards(savedBoards)}
                      </Tab.Pane>
                    ),
                  },
                ]}
                defaultActiveIndex={initialIndex}
              />
            </div>
          ) : (
            <div style={{ marginTop: isPlaygroundEmpty && "15%" }}>
              {content}
            </div>
          )}
        </div>
        <VSpacer />
      </div>
    );
  };

  renderPlayground = (boardContext) => {
    const {
      description,
      boardName,
      sidechainRouting,
      outputRouting,
      inputRouting,
    } = this.state;
    return (
      <Board
        ref={(board) => (this.board = board)}
        boardContext={boardContext}
        allowedServices={allowedServices}
        description={description}
        boardName={boardName}
        sidechainRouting={sidechainRouting}
        outputRouting={outputRouting}
        onChangeOutputRouting={(runtime, { peer, flow }) => {
          const data = {
            ...outputRouting,
          };

          if (peer) {
            data.peer = peer;
          }

          if (flow) {
            data.flow = flow;
          }

          this.setState({
            outputRouting: {
              ...this.state.outputRouting,
              [runtime.id]: data,
            },
          });

          this.setState({
            outputRouting: {
              ...this.state.outputRouting,
              [runtime.id]: {
                ...outputRouting,
                peer,
              },
            },
          });
        }}
        inputRouting={inputRouting}
        onChangeInputRouting={(runtime, value) =>
          this.setState({
            inputRouting: {
              ...this.state.inputRouting,
              [runtime.id]: value,
            },
          })
        }
        onChangeSidechainRouting={(runtime, routing) =>
          this.setState({
            sidechainRouting: {
              ...this.state.sidechainRouting,
              [runtime.id]: routing,
            },
          })
        }
      />
    );
  };

  isActionAvailable = (action) => {
    switch (action) {
      case "shareBoard":
        return false;
      case "saveBoard":
      case "clearBoard":
        return this.state.runtimes;
      default:
        return true;
    }
  };

  renderSourceCode = (boardName) => {
    const { editSourceCode } = this.state;
    const src = this.restoreBoardFromLocalStorage(boardName) || "";
    if (editSourceCode) {
      return (
        <div style={{ height: "100%" }}>
          <Button
            style={s(t.m5, t.uc, t.ls1, t.fs12)}
            onClick={() => {
              const src = this.editor.getValue();
              localStorage.setItem(`hkp-playground-${boardName}`, src);
            }}
          >
            Save
          </Button>
          <Button
            style={s(t.m5, t.uc, t.ls1, t.fs12)}
            onClick={this.closeSourceView}
          >
            Close
          </Button>
          <Editor
            ref={(editor) => (this.editor = editor)}
            language="json"
            value={JSON.stringify(src, null, 2)}
          />
        </div>
      );
    }
    return (
      <div>
        <div
          style={{
            position: "sticky",
            top: 0,
            width: "100%",
            backgroundColor: "white",
          }}
        >
          <Button
            style={s(t.mt10, t.mh(5), t.uc, t.ls1, t.fs12)}
            onClick={() => this.setState({ editSourceCode: true })}
          >
            Edit
          </Button>
          <Button
            style={s(t.m5, t.uc, t.ls1, t.fs12)}
            onClick={this.closeSourceView}
          >
            Close
          </Button>
          <hr style={{ borderTop: "1px solid lightgray" }} />
        </div>
        <div style={{ fontFamily: "monospace", margin: 5 }}>
          <pre> {JSON.stringify(src, null, 2)} </pre>
        </div>
      </div>
    );
  };

  renderContent = (boardContext) => {
    const { initialFetched } = this.state;
    if (!initialFetched) {
      return (
        <div
          style={s(t.uc, t.ls1, {
            position: "absolute",
            left: "45%",
            top: "45%",
          })}
        >
          <Loader active inline>
            Loading Playground
          </Loader>
        </div>
      );
    }
    return this.renderPlaceholderOrPlayground(boardContext);
  };

  render() {
    const { boardName } = this.state;
    const { pathname } = window.location;
    const lastPathItem = pathname.split("/").slice(-1)[0];
    if (lastPathItem === "src") {
      return this.renderSourceCode(boardName);
    }
    return (
      <BoardProvider
        key={`playground-${boardName}`}
        user={this.user}
        boardName={boardName}
        fetchData={this.fetchData}
        isRuntimeInScope={() => true}
        addRuntime={this.addRuntime}
        removeRuntime={this.removeRuntime}
        addService={this.addService}
        removeService={this.removeService}
        newBoard={this.newBoard}
        clearBoard={this.clearPlayground}
        saveBoard={this.saveBoard}
        shareBoard={this.shareBoard}
        arrangeService={this.arrangeService}
        isActionAvailable={this.isActionAvailable}
        setRuntimeName={this.setRuntimeName}
      >
        <BoardConsumer>
          {(boardContext) => (
            <div id="playground-root" style={t.fill}>
              <Toolbar
                board={boardName}
                availableRuntimes={this.availableRuntimes}
              />
              {this.renderContent(boardContext)}
              <Footer />
            </div>
          )}
        </BoardConsumer>
      </BoardProvider>
    );
  }
}
