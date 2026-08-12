/**
 * LOGGER - Centralized logging
 * Có thể bật/tắt qua window.__isProduction flag
 *
 * Usage:
 *   const log = Logger.create('MyModule');
 *   log.debug('some debug');     // [MyModule] some debug
 *   log.info('some info');
 *   log.warn('some warn');
 *   log.error('some error', err);  // luôn log error
 */

(function (global) {
    'use strict';

    const Logger = {
        isProduction: function () {
            return !!global.__isProduction;
        },

        /**
         * Tạo logger cho 1 module
         */
        create: function (moduleName) {
            const self = this;
            const fmt = function (level, args) {
                const prefix = '[' + moduleName + '] [' + level + ']';
                return [prefix].concat(Array.prototype.slice.call(args));
            };
            return {
                debug: function () {
                    if (self.isProduction()) return;
                    // eslint-disable-next-line no-console
                    console.log.apply(console, fmt('DEBUG', arguments));
                },
                info: function () {
                    if (self.isProduction()) return;
                    // eslint-disable-next-line no-console
                    console.info.apply(console, fmt('INFO', arguments));
                },
                log: function () {
                    if (self.isProduction()) return;
                    // eslint-disable-next-line no-console
                    console.log.apply(console, fmt('LOG', arguments));
                },
                warn: function () {
                    // warning vẫn log ở production
                    // eslint-disable-next-line no-console
                    console.warn.apply(console, fmt('WARN', arguments));
                },
                error: function () {
                    // error LUÔN log
                    // eslint-disable-next-line no-console
                    console.error.apply(console, fmt('ERROR', arguments));
                }
            };
        }
    };

    if (typeof global !== 'undefined') {
        global.Logger = Logger;
    }

})(typeof window !== 'undefined' ? window : globalThis);
