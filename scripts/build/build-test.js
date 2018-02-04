#!/usr/bin/env node

const path = require('path');

const rimraf = require('rimraf');
const program = require('commander');

rimraf.sync(path.resolve(__dirname, './dist'));
const pack = require('./pack.js');
const types = ['simple-component', 'component', 'page'];
const type2configPath = types.map(type =>
  ({[type]: path.resolve(__dirname, `./examples/${type}.json`)})
).reduce((a, v, i) => Object.assign(a, v), {});

program
  .version('0.0.1')
  .option('-t, --type [type]', `Build the specified type of examples, such as ${Object.keys(type2configPath)}`)
  .option('-c, --config [fullPath]', 'Build the specified configuration file')
  .parse(process.argv);

const configPath = type2configPath[program.type] || program.config;
if (!configPath) {
  console.error('No --type or --config specified');
  process.exit(1);
}
console.log(`Packing ${configPath}...`);
pack(configPath);
