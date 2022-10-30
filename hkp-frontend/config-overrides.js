const fs = require("fs");
const path = require("path");

module.exports = function override(config, env) {
  const paths = {
    appPath: process.cwd(), //config.plugins[2].appPath,
    //"/Users/cbastuck/Development/Projects/hookup/packages/hkp-frontend", // TODO
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
    options: {
      ...appCompile.options,
      sourceType: "unambiguous",
    },
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
