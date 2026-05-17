/* OpeningOS environment defaults.
 * Keep deployment-specific constants in this external file so the CSP can stay
 * strict while the GitHub Pages frontend still knows the production API URL.
 */
(function (global) {
  'use strict';
  const DEFAULT_BACKEND_URL = 'https://monkfish-app-yxidj.ondigitalocean.app';
  global.OPENINGOS_ENV = Object.assign({
    backendUrl: DEFAULT_BACKEND_URL,
    appMode: 'production',
    supportEmail: '',
  }, global.OPENINGOS_ENV || {});
  // Legacy alias used by some older integration layers.
  if (!global.OPENINGOS_BACKEND_URL) global.OPENINGOS_BACKEND_URL = global.OPENINGOS_ENV.backendUrl;
})(window);
