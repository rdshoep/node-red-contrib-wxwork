const path = require('path');
const fs = require('fs');
const util = require('util');
const chokidar = require('chokidar');
const _ = require('lodash');
const shell = require('shelljs');
const { spawn } = require('child_process');

const PROJECT_FOLDER = path.resolve(__dirname, '..');
const PACKAGE_JSON_FILE_PATH = path.resolve(PROJECT_FOLDER, 'package.json');

const readJsonFile = async (path) => {
  const text = await util.promisify(fs.readFile)(path, 'utf8');
  return JSON.parse(text);
};

const writeJsonFile = (path, json) =>
  util.promisify(fs.writeFile)(path, JSON.stringify(json, null, 2));

const defaultWatchingFileArray = [PACKAGE_JSON_FILE_PATH];

const collectWatchingFiles = (packageJson) => {
  const nodeJsFileList = _.values(
    _.defaultTo(_.get(packageJson, ['node-red', 'nodes']), {}),
  );
  return [].concat(
    defaultWatchingFileArray,
    _.flatMap(
      nodeJsFileList.map((jsFile) => {
        const jsFullPath = path.resolve(PROJECT_FOLDER, jsFile);
        return [jsFullPath, jsFullPath.replace(/\.js$/, '.html')];
      }),
    ),
  );
};

const generateNewVersion = (oldVersion) => {
  const [prefix, random] = oldVersion.split('-');
  return [prefix, Math.floor(Date.now() / 1000).toString('36')].join('-');
};

const nodeRedServerPath = '/Users/zhangliang/project/github/node-red';
let serverProcess;
const restartNodeRedServer = () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  serverProcess = spawn('npm', ['start'], {
    cwd: nodeRedServerPath,
    stdio: 'pipe',
  });
  serverProcess.on('close', (code) => {
    console.log(`node red server stop with ${code}`);
  });
  console.log('node red server started. open http://127.0.0.1:1880/');
};

const rebuildRuntime = async (packageJson) => {
  if (!packageJson) {
    packageJson = await readJsonFile(PACKAGE_JSON_FILE_PATH);
  }
  // update new package version
  packageJson.version = generateNewVersion(packageJson.version);
  await writeJsonFile(PACKAGE_JSON_FILE_PATH, packageJson);
  // exec npm install pwd to ~/.node-red
  shell.cd('~/.node-red');
  shell.exec(`npm install ${PROJECT_FOLDER}`);
  // restart node-red package
  restartNodeRedServer();
};

const startWatch = (watchingFileList) => {
  console.log(`start watch files:\n${watchingFileList.join('\n')}`);
  const watcher = chokidar.watch(watchingFileList, {
    persistent: true,
  });
  watcher
    .on('ready', () =>
      console.log('Watcher initial scan complete. Ready for changes'),
    )
    .on('raw', async (event, path) => {
      if (event !== 'modified') return;
      if (watchingFileList.indexOf(path) < 0) return;
      console.log(`Watching File Changed: ${path}`);
      const packageJson = await readJsonFile(PACKAGE_JSON_FILE_PATH);
      if (path === PACKAGE_JSON_FILE_PATH) {
        const newWatchingFileList = collectWatchingFiles(packageJson);
        if (_.difference(watchingFileList, newWatchingFileList).length) {
          watcher.unwatch(watchingFileList);
          startWatch(newWatchingFileList);
        }
      } else {
        await rebuildRuntime(packageJson);
      }
    });
};

(async () => {
  const packageJson = await readJsonFile(PACKAGE_JSON_FILE_PATH);
  await rebuildRuntime(packageJson);
  startWatch(collectWatchingFiles(packageJson));
})();
