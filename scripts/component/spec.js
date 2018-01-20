const fs = require('fs');
const path = require('path');
const {promisify} = require('util');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

const CWD = process.cwd();
const COMPONENTS_DIR = path.resolve(CWD, './node_modules/antd-mobile/components');
const OUTPUT_FILE = path.resolve(CWD, './config/component-spec.json');

function getSourceDocFiles(dir) {
  return readdir(dir)
    .then(files => {
      return Promise.all(files.map(async (file) => {
        let curPath = path.resolve(dir, file);
        let st = await stat(curPath);
        if (st.isDirectory()) {
          let docPath = path.resolve(curPath, 'index.zh-CN.md');
          let st = null;
          try {
            st = await stat(docPath);
          }catch(ex) {
            st = null;
          }
          if (st && st.isFile()) {
            return readFile(docPath);
          }
        }
      }));
    });
}

function extractTables(doc) {
  const REG_META_TABLE = /^--+$((.|\r|\n)*)^--+$/m;
  const REG_PROPS_TABLE = /^(?:\|?--+\|)+--+\|?$/m;
  const REG_BLANK_LINE = /^\s*[\r\n]/m;
  let metaTable = doc.match(REG_META_TABLE);
  metaTable && (metaTable = metaTable[1]);
  metaTable && (metaTable = metaTable.trim().split(/[\r\n]+/g).reduce((a, v) => {
    let cells = v.split(/:|：/).map(v => v.trim());
    a[cells[0]] = cells[1];
    return a;
  }, {}));
  let rawTables = doc.split(REG_PROPS_TABLE);
  rawTables.shift();
  let propsTable = [];
  rawTables.forEach(rawTable => {
      rawTable = rawTable.trim();
      rawTable = rawTable.split(REG_BLANK_LINE);
      rawTable && (rawTable = rawTable[0]);
      propsTable = propsTable.concat(extractProps(rawTable));
  });

  return {metaTable, propsTable};
}

function extractProps(table) {
  const PLACEHOLDER = '{BACK_SLASH_PIPE}';
  return table
    .split(/\r?\n/)
    .map(row =>
      row.replace(/\\\|/g, PLACEHOLDER)
        .split('|')
        .map(v => v.replace(new RegExp('\\s*' + PLACEHOLDER + '\\s*', 'g'), '或'))
        .map(cell => cell.trim().replace(/[`]|(?:\s*<br\/>\s*)|(?:\\)/g, ''))
    ).filter(row => row.length > 0 && row.reduce((a, cell) => !!cell || a, false));
}

function wrapAsComponent(confTable) {
  const {metaTable, propsTable} = confTable;
  return {
    title: metaTable.title,
    subtitle: metaTable.subtitle,
    version: metaTable.version || '1.0.0',
    meta: {
        atomic: true,
        functional: propsTable.length === 0
    },
    props: propsTable.map(row => ({
      key: row[0],
      descrition: row[1],
      type: row[2],
      default: row[3],
      required: /\s*true\s*/.test(row[4] || ''),
      configurable: false,
      loggable: false,
    }))
  }
}

getSourceDocFiles(COMPONENTS_DIR).then((docs) => {
  docs = docs.filter(doc => doc).map(doc => doc.toString());
  let tables = [];
  docs.forEach(doc => {
    tables.push(extractTables(doc));
  });
  let components = tables.map(table => wrapAsComponent(table));
  writeFile(OUTPUT_FILE, JSON.stringify(components))
    .then(() => {
      console.log('Components spec has been saved to ' + OUTPUT_FILE);
    }, (e) => {
      console.error(e);
    });
});

 