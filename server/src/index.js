'use strict';

const register = require('./register');
const config = require('./config');
const routes = require('./routes');
const controllers = require('./controllers');
const services = require('./services');

/**
 * knowledge-base plugin (server).
 *
 * Owns no database table: the documentation itself is a set of JSON files on
 * disk, one per admin language, which makes it reviewable in git and keeps the
 * project's database untouched.
 */
module.exports = {
  register,
  bootstrap() {},
  destroy() {},
  config,
  routes,
  controllers,
  services,
};
