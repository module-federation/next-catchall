let Sentry;
if (process.browser) {
  Sentry = require("@sentry/browser");
  if (!window.sentryHub) {
    window.sentryHub = __SENTRY_HUB__;
  }
} else {
  Sentry = require("@sentry/node");
  if (!global.sentryHub) {
    global.sentryHub = __SENTRY_HUB__;
  }
}

let hub = sentryHub;

const federatedSentry = (options) => {
  const name = options.name;
  delete options.name;
  if (typeof window !== "undefined") {
    options.beforeSend = (event) => {
      const request = {
        url: window.location.href,
        headers: { "User-Agent": navigator.userAgent },
      };
      if (event.request) {
        Object.assign(event.request, request);
      } else {
        event.request = request;
      }
      return event;
    };
  }
  console.log("create federated sentry", name);
  if (!hub[name]) {
    const client = process.browser
      ? new Sentry.BrowserClient(options)
      : new Sentry.NodeClient(options);
    hub[name] = new Sentry.Hub(client);
  }
};
const captureException = (exception, host = process.env.CURRENT_HOST) => {
  try {
    // try and send error to the hub
    hub[host].captureException(exception);
  } catch {
    // if hub isnt registered, send error to global handler, if exists
    Sentry.captureException(exception);
  }
};
module.exports = { federatedSentry, captureException };
