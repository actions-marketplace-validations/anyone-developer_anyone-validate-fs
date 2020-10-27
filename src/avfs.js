const braces = require('braces');
const fs = require('fs');
const path = require('path');
const rrdir = require('rrdir');
const chalk = require('chalk');
const treeify = require('treeify');
let Table = require('tty-table');

let expectCount = 0;
let matchCount = 0;
let unmatchCount = 0;
let logger = global.logger ? global.logger : console;

function oneOfItemEndsWithPath(path, array) {
  for (const e of array) {
    if (e == path || path.endsWith(e)) {
      logger.info(chalk.green("matching FROM: " + path + " TO: " + e));
      array.push(path);
      return true;
    }
  }
  return false;
}

function getNextPath(path) {
  return path.split('\\').slice(1).join('\\');
}

function getNextLevelPath(path) {
  let paths = path.split('\\');
  if (paths.length > 1) {
    return paths.slice(1).join('\\');
  }
  return null;
}

function getTopLevelPath(path) {
  return path.split('\\')[0];
}

function getTreeNode(array) {
  let object = {};
  for (const a of array) {
    const top = getTopLevelPath(a);
    const next = getNextLevelPath(a);
    if (!next) {
      object[top] = "file";
      continue;
    }
    const subArray = array.filter(i => i.startsWith(top)).map(i => getNextLevelPath(i));
    if (!object.hasOwnProperty(top)) {
      object[top] = { ...getTreeNode(subArray) };
    }
  }
  return object;
}

const avfs = function (
  readPath = 'sample_folder',
  expansion = '{{a,b/{ba1,ba2,bb1,bb2},c,d}/{a.qa.config,b.prd.config},x/p/a/b/c/{a.qa.config,a.prd.config}}',
  ignoreFiles = "README.md",
  ignoreDirectories = ".git") {
  return new Promise((resolve, reject) => {
    try {
      if (!expansion) {
        logger.error(chalk.red("param 'brace-expansion' is required"));
        reject({
          type: "insufficient param",
          message: "param 'brace-expansion' is required"
        });
        return;
      }

      readPath = path.normalize(readPath);
      const ignoreFilesArray = ignoreFiles.split(',').map(i => path.normalize(readPath + "\\" + i));
      const ignoreDirectoriesArray = ignoreDirectories.split(',').map(i => path.normalize(readPath + "\\" + i));

      const expectStructure = braces(expansion, { expand: true }).map(i => {
        return path.normalize(i);
      });

      const expectTree = getTreeNode(expectStructure);

      const expectTreeHeader = chalk.blueBright.bgYellowBright.bold("[Expect]");
      const expectTreeSubHeader = chalk.blueBright.bold("brace-expansion");
      const expectTreeContent = chalk.blue(treeify.asTree(expectTree));
      // logger.info(expectTreeHeader);
      // logger.info(expectTreeContent);

      if (!fs.existsSync(readPath)) {
        logger.error(chalk.red("the path: " + readPath + " was not existed"));
        reject({
          type: "insufficient param",
          message: "the path: " + readPath + " was not existed"
        });
        return;
      }

      let actualPath = rrdir.sync(readPath, {
        exclude: [...ignoreDirectoriesArray, ...ignoreFilesArray],
        strict: true
      });

      actualPath = actualPath.map(i => {
        return {
          path: getNextPath(path.normalize(i.path)),
          directory: i.directory,
          symlink: i.symlink
        }
      }).filter(i => !i.directory);
      actualPath = [...actualPath.map(i => i.path)];
      const actualTree = getTreeNode(actualPath);

      const actualTreeHeader = chalk.greenBright.bgYellowBright.bold("[Actual]");
      const actualTreeSubHeader = chalk.greenBright.bold("under: " + readPath);
      const actualTreeContent = chalk.green(treeify.asTree(actualTree));

      const out = Table([
        {
          value: expectTreeHeader
        },
        {
          value: actualTreeHeader
        }], 
        [
          [expectTreeSubHeader, actualTreeSubHeader],
          [expectTreeContent, actualTreeContent]
        ], 
        {
          borderStyle: "solid",
          borderColor: "gray",
          headerAlign: "center",
          align: "left",
          color: "white",
          width: "100%"
        }).render();
      console.log(out);
      
    } catch (error) {
      logger.error(chalk.red(error.message));
      reject({
        type: error,
        message: error.message
      });
    } finally {
      if (unmatchCount > expectCount || unmatchCount > 0) {
        reject({
          expectCount: expectCount,
          matchCount: matchCount,
          unmatchCount: unmatchCount
        });
      }
      else {
        resolve({
          expectCount: expectCount,
          matchCount: matchCount,
          unmatchCount: unmatchCount
        });
      }
    }
  });
}

module.exports = avfs;