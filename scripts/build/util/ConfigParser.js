const _ = require('lodash');

function parse(json, components) {
  const {component, version, props = {}, children = []} = json;
  // Top level
  const isTopLevel = !components;
  if (isTopLevel) components = [];
  collectComponents(components, component);
  const propsString = Object.keys(props).reduce((a, v, i) =>
    a + (a ? ' ' : '') + `${v}=${parsePropValue(props[v], components)}`, '');
  const childrenString = children.reduce((a, v, i) =>
    a + (v && typeof v === 'object' ? parse(v, components) : v + ''), '');
  const jsxString = `<${component}${propsString ? ' ' + propsString : ''}>${childrenString}</${component}>`;
  if (!isTopLevel) return jsxString;
  const css = _.get(json, ['extra', 'css']) || [];
  const js = _.get(json, ['extra', 'js']) || [];
  return {
    components: components,
    jsx: jsxString,
    css: {
      inline: _.map(_.filter(css, v => v.type === 'inline' && v.content), v => v.content),
      external: _.map(_.filter(css, v => v.type === 'external' && v.url), v => v.url)
    },
    js: {
      inline: _.map(_.filter(js, v => v.type === 'inline' && v.content), v => v.content),
      external: _.map(_.filter(js, v => v.type === 'external' && v.url), v => v.url)
    }
  };
}

function parsePropValue(v = '', components) {
  const isInterpolation = Array.isArray(v);
  let value = v;
  if (isInterpolation) {
    value = v[0];
    let extraComponents = Array.isArray(v[1]) ? v[1] : [v[1]];
    if (v.length > 1) extraComponents.forEach(component =>
      collectComponents(components, component));
  }
  return isInterpolation ? `{${value}}` : `"${value}"`;
}

function collectComponents(components, component) {
  if (isComponent(component) && components.indexOf(component) === -1) {
    components.push(component);
  }
}

function isComponent(component) {
  return /^[A-Z]/.test(component);
}

function resolveImport(components) {
  return [
    `import ReactDOM from 'react-dom';`,
    `import { ${components.join(', ')} } from 'antd-mobile';`
  ].join('\n');
}

function resolveJSX(jsx) {
  // Wrapped into a VirtualApp
  return `\n\nconst VirtualApp = () => (${jsx});` +
    `\n\n\nReactDOM.render(<VirtualApp/>, document.querySelector('#app'));`;
}

function resolveCSS(css) {
  let inline = '', external = '';
  let inlineCSS = css.inline;
  if (Array.isArray(inlineCSS)) inlineCSS = inlineCSS.join('\n\n');
  if (inlineCSS) {
    inline = `<style>${inlineCSS}</style>`;
  }
  let externalCSS = css.external;
  if (externalCSS) {
    if (!Array.isArray(externalCSS)) externalCSS = [externalCSS];
    externalCSS.forEach(url => external += `<link rel="stylesheet" href="${url}" />`);
  }

  return {
    inline,
    external
  };
}

function resolveJS(js) {
  let inline = '', external = '';
  let inlineJS = js.inline;
  if (Array.isArray(inlineJS)) inlineJS = inlineJS.join('\n\n');
  if (inlineJS) {
    inline = `<script>${inlineJS}</style>`;
  }
  let externalJS = js.external;
  if (externalJS) {
    if (!Array.isArray(externalJS)) externalJS = [externalJS];
    externalJS.forEach(url => external += `<script src="${url}"></script>`);
  }

  return {
    inline,
    external
  };
}

function ConfigParser(json) {
  this.inputJSON = json;
}
ConfigParser.prototype.parse = function() {
  let json = this.inputJSON;
  if (!json) return '';
  if (typeof json === 'string') json = JSON.parse(json);
  this.parseResult = parse(json);
  return this.parseResult;
};
ConfigParser.prototype.bundle = function() {
  if (!this.parseResult) this.parse();
  let {components, jsx, css, js} = this.parseResult;
  return {
    jsx: resolveImport(components) + resolveJSX(jsx),
    css: resolveCSS(css),
    js: resolveJS(js)
  };
};

module.exports = ConfigParser;
