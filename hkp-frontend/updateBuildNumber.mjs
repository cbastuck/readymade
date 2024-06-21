import fs from "fs";

const buildFn = "./src/buildNumber.json";
const pack = JSON.parse(fs.readFileSync("./package.json").toString());
const { version } = JSON.parse(fs.readFileSync(buildFn).toString());

// major and and minor version are determined via package json
const [major, minor] = pack.version.split(".").map((x) => Number(x));

// build number is determined by generated build file
const [oldMaj, oldMin, build] = version.split(".").map((x) => Number(x));

// reset the build number if the major or minor number changed
const buildNumber = oldMaj < major || oldMin < minor ? 0 : build + 1;

const updatedVersion = { version: `${major}.${minor}.${buildNumber}` };
fs.writeFileSync(buildFn, JSON.stringify(updatedVersion));
