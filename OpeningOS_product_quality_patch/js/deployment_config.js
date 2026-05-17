/* OpeningOS deployment defaults.
 * Edit this file when you move the backend to a custom domain.
 */
(function (global) {
  'use strict';
  global.OOSDeployment = Object.assign({
    backendUrl: 'https://monkfish-app-yxidj.ondigitalocean.app',
    frontendUrl: 'https://armaanmittalweb.github.io/OpeningOS',
    productMode: 'saas'
  }, global.OOSDeployment || {});
})(window);
