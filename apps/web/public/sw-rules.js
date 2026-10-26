// Which requests the service worker answers (loaded by sw.js with importScripts; unit-tested as a module).
// Only public things are ever stored: the offline page, icons and hashed build files. Pages and API answers
// depend on who is signed in, so they always come from the network.
(function (root) {
  var CACHE = "kr-static-v1";
  var PRECACHE = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];

  /** "static": cache first. "page": network, the offline page if it fails. "pass": not ours, the browser handles it. */
  function route(req, origin) {
    if (req.method !== "GET") return "pass";
    var url = new URL(req.url);
    if (url.origin !== origin) return "pass";
    var path = url.pathname;
    if (path.indexOf("/api/") === 0) return "pass";
    if (
      path.indexOf("/_next/static/") === 0 ||
      path.indexOf("/icons/") === 0 ||
      PRECACHE.indexOf(path) !== -1
    )
      return "static";
    return req.mode === "navigate" ? "page" : "pass";
  }

  root.krSw = { CACHE: CACHE, PRECACHE: PRECACHE, route: route };
})(typeof self !== "undefined" ? self : globalThis);
