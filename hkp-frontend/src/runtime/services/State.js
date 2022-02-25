const serviceId = "hookup.to/service/state";
const serviceName = "State";

class State {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.state = {};
  }

  configure(config) {
    const { macros } = config || {};
    if (macros) {
      this.macros = Object.keys(macros).reduce(
        (all, macro) => ({ ...all, [macro]: macros[macro] }),
        {}
      );
    }
  }

  replaceMacroVariables(variables, item, template, key) {
    const regex = /\$value/gi;
    const templateValue = template[key];
    if (variables.indexOf(key) === -1) {
      return templateValue;
    }

    if (!regex.test(templateValue)) {
      return templateValue;
    }

    const replacement = item[key];
    return replacement ? templateValue.replace(regex, replacement) : undefined;
  }

  processMacros(input) {
    return input
      .map((item) => {
        const type = item.type || "";
        if (item.type && type.startsWith("macro:")) {
          const name = type.split("macro:")[1];
          const macro = this.macros[name];
          if (!macro) {
            console.error(
              `Could not find macro with name: ${name} in macros: ${JSON.stringify(
                this.macros
              )}`
            );
            return undefined;
          }
          // set item to macro and replace variables
          const templates = Array.isArray(macro.template)
            ? macro.template
            : [macro.template];
          return templates.map((template) =>
            Object.keys(template).reduce((obj, key) => {
              const value = this.replaceMacroVariables(
                macro.variables,
                item,
                template,
                key
              );
              return value !== undefined ? { ...obj, [key]: value } : obj;
            }, {})
          );
        }
        return item;
      })
      .flat();
  }

  process(objectOrArray) {
    if (!objectOrArray) {
      return undefined;
    }

    if (!Array.isArray(objectOrArray)) {
      return this.process([objectOrArray]);
    }

    const preProcessed = this.processMacros(objectOrArray);
    return preProcessed.map((item) => {
      const id = item && item.id;
      const ref = item && item.ref;
      if (!id && !ref) {
        return item;
      }

      if (id) {
        this.state[id] = item;
        return item;
      }

      // item references the internal state
      const state = this.state[ref];
      if (!state) {
        console.error(`Referenced state does not exist: ${ref}`);
        return item;
      }

      return Object.keys(item).reduce(
        (all, key) => ({ ...all, [key]: item[key] }),
        state
      );
    });
  }
}

const descriptor = {
  serviceName,
  serviceId,
  create: (app, board, descriptor, id) => new State(app, board, descriptor, id),
};

export default descriptor;
