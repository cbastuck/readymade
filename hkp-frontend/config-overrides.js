const fs = require("fs");
const path = require("path");

module.exports = function override(config, env) {
  const paths = {
    appPath:
      //"/Users/cbastuck/Development/Projects/hookup.to/packages/hkp-frontend", // TODO
      config.plugins[2].appPath,
  };

  const wsPackageFn = path.resolve(`${paths.appPath}/../../package.json`);
  const workspaces =
    fs.existsSync(wsPackageFn) && require(wsPackageFn).workspaces;
  const workspacePaths = workspaces
    ? workspaces.map((ws) => path.resolve(`${paths.appPath}/../../${ws}`))
    : [];

  // console.log("Config ...", JSON.stringify(config, null, 2));
  const appCompile = config.module.rules[1].oneOf[3];
  config.module.rules[1].oneOf[3] = {
    ...appCompile,
    include: [appCompile.include, ...workspacePaths],
  };
  config.resolve = {
    ...config.resolve,
    fallback: {
      fs: false,
      crypto: false,
      buffer: false,
      stream: false,
      util: false,
    },
  };
  return config;
};
