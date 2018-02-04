const path = require('path');
const fs = require('fs');

const _ = require('lodash');
const webpack = require('webpack');
const VirtualModulePlugin = require('virtual-module-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const autoprefixer = require('autoprefixer');
const pxtorem = require('postcss-pxtorem');
const ConfigParser = require('./util/ConfigParser');

const Visualizer = require('webpack-visualizer-plugin'); // remove it in production environment.
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin; // remove it in production environment.
const otherPlugins = process.argv[1].indexOf('webpack-dev-server') >= 0 ? [] : [
  new Visualizer(), // remove it in production environment.
  new BundleAnalyzerPlugin({
    defaultSizes: 'parsed',
    // generateStatsFile: true,
    statsOptions: { source: false }
  }), // remove it in production environment.
];

const postcssOpts = {
  ident: 'postcss', // https://webpack.js.org/guides/migrating/#complex-options
  plugins: () => [
    autoprefixer({
      browsers: ['last 2 versions', 'Firefox ESR', '> 1%', 'ie >= 8', 'iOS >= 8', 'Android >= 4'],
    }),
    // pxtorem({ rootValue: 100, propWhiteList: [] })
  ],
};
const wrapedEntryPath = './entry.js';
const virtualEntryPath = './app.jsx';
const virtualPlaceholdersPath = [
  './before-app.css',
  './before-app.js',
  './after-app.css',
  './after-app.js'
];

let config = (actualEntryContent, placeholdersContent = {}) => ({
  devtool: 'source-map', // or 'inline-source-map'
  devServer: {
    disableHostCheck: true
  },

  entry: { "index": wrapedEntryPath },

  output: {
    filename: '[name].js',
    chunkFilename: '[id].chunk.js',
    path: path.join(__dirname, '/dist'),
    publicPath: '/dist/'
  },

  resolve: {
    modules: [path.resolve(__dirname, '../../node_modules'), path.join(__dirname, 'examples')],
    extensions: ['.web.js', '.jsx', '.js', '.json'],
  },

  module: {
    rules: [
      {
        test: /\.jsx$/, exclude: /node_modules/, loader: 'babel-loader',
        options: {
          plugins: [
            'external-helpers', // why not work?
            ["transform-runtime", { polyfill: false }],
            ["import", [{ "style": "css", "libraryName": "antd-mobile" }]]
          ],
          presets: ['es2015', 'stage-0', 'react']
          // presets: [['es2015', { modules: false }], 'stage-0', 'react'] // tree-shaking
        }
      },
      { test: /\.(jpg|png)$/, loader: "url-loader?limit=8192" },
      // 注意：如下不使用 ExtractTextPlugin 的写法，不能单独 build 出 css 文件
      // { test: /\.less$/i, loaders: ['style-loader', 'css-loader', 'less-loader'] },
      // { test: /\.css$/i, loaders: ['style-loader', 'css-loader'] },
      {
        test: /\.less$/i, use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: [
            'css-loader', { loader: 'postcss-loader', options: postcssOpts }, 'less-loader'
          ]
        })
      },
      {
        test: /\.css$/i, use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: [
            'css-loader', { loader: 'postcss-loader', options: postcssOpts }
          ]
        })
      }
    ]
  },
  externals: {
    "react": "React",
    "react-dom": "ReactDOM"
  },
  plugins: [
    new VirtualModulePlugin({
      moduleName: virtualEntryPath,
      contents: actualEntryContent
    }),
    ...(virtualPlaceholdersPath.map(path =>
      new VirtualModulePlugin({
        moduleName: path,
        contents: placeholdersContent[path] || ''
      })
    )),
    new webpack.optimize.ModuleConcatenationPlugin(),
    // new webpack.optimize.CommonsChunkPlugin('shared.js'),
    new webpack.optimize.CommonsChunkPlugin({
      // minChunks: 2,
      name: 'shared',
      filename: 'shared.js'
    }),
    new ExtractTextPlugin({ filename: '[name].css', allChunks: true }),
    ...otherPlugins
  ]
});

module.exports = function startup(configPath) {
  // setup dev server
  const express = require('express'); //your original BE server
  const app = express();
  const PORT = 8887;

  const parser = new ConfigParser(require(configPath));
  const parsed = parser.parse();
  const bundle = parser.bundle();
  const actualEntryContent = bundle.jsx;
// console.log(actualEntryContent);
// console.log(parsed.css);
// console.log(parsed.js);
  const compiler = webpack(config(actualEntryContent, {
    './after-app.css': (_.get(parsed.css, ['inline']) || []).join('\n'),
    './after-app.js': (_.get(parsed.js, ['inline']) || []).join('\n')
  }));
  compiler.run((err, stats) => {
    if (err || stats.hasErrors()) {
      // Handle errors here
      console.error(err);
    }
    // Done processing
    console.log('Build successfully.');
    //!!! Seems not working on Windows
    // app.use(middleware(compiler, {
    //   publicPath: config.output.publicPath,
    //   stats: {colors: true},
    //   log: console.log
    // }));
    // Fallback to static host
    app.use(express.static('./'));
    app.get('/', function (req, res) {
      res.redirect(302, './index.html');
    });
    app.listen(PORT, () => console.log(`Webpack dev server is running on http://127.0.0.1:${PORT}`));
  });
}
