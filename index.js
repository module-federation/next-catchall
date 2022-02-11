const React = require("react");
const createMatcher = require("feather-route-matcher").default;
// const { Parser, ProcessNodeDefinitions } = require("html-to-react");
// const stringifyDeterministic = require("json-stringify-deterministic");
// const sortRecursive = require("sort-keys-recursive");
// const ErrorBoundary = require("./ErrorBoundary");
// const { captureException } = require("./sentry");
// const { useRouter } = require("next/router");

//catch all handling

async function matchFederatedPage(remotes, path) {
  if (!remotes) {
    console.error(
      "No __REMOTES__ webpack global defined or no remotes passed to catchAll"
    );
  }
  const maps = await Promise.all(
    Object.entries(remotes).map(([remote, loadRemote]) => {
      console.log("page map", remote, loadRemote);
      const loadOrReferenceRemote = !window[remote]
        ? loadRemote()
        : window[remote];

      return Promise.resolve(loadOrReferenceRemote).then((container) => {
        return container
          .get("./pages-map")
          .then((factory) => ({ remote, config: factory().default }))
          .catch(() => null);
      });
    })
  );
  const config = {};

  for (let map of maps) {
    if (!map) continue;

    for (let [path, mod] of Object.entries(map.config)) {
      config[path] = {
        remote: map.remote,
        module: mod,
      };
    }
  }

  const matcher = createMatcher(config);
  const match = matcher(path);

  return match;
}

function createFederatedCatchAll(remotes, ErrorComponent, NotFoundComponent) {
  const FederatedCatchAll = (initialProps) => {
    const [lazyProps, setProps] = React.useState({});

    const { FederatedPage, render404, renderError, needsReload, ...props } = {
      ...lazyProps,
      ...initialProps,
    };

    React.useEffect(() => {
      console.log(" in effect", FederatedPage, "needs reload", needsReload);
      if (needsReload) {
        FederatedCatchAll.getInitialProps(props).then((federatedProps) => {
          console.log("federated props", federatedProps);

          setProps(federatedProps);
        });
      }
    }, []);

    const params =
      typeof window === "undefined"
        ? null
        : new URLSearchParams(location.search);
    const is404 = !!params && params.has("404");
    React.useEffect(() => {
      if (!is404 && render404) {
        params.set("404", "1");
        location.replace(location.pathname + "?" + params.toString());
      }
    }, [render404, is404]);

    if (render404) {
      if (is404) {
        return NotFoundComponent
          ? React.createElement(NotFoundComponent, props)
          : React.createElement("h1", {}, "404 Not Found");
      } else {
        return null;
      }
    }

    if (renderError) {
      return ErrorComponent
        ? React.createElement(ErrorComponent, props)
        : React.createElement("h1", {}, "Oops, something went wrong.");
    }
    console.log(initialProps.FederatedPage,lazyProps.FederatedPage)

    if (lazyProps.FederatedPage) {
      console.log('page exists')
      return React.createElement(lazyProps.FederatedPage, props)
    }
    if (initialProps.FederatedPage) {
      console.log('page exist on initial')
      return React.createElement(initialProps.FederatedPage, props)
    }
    if(needsReload) {
      return null
    }
    if(process.browser) {
      window.location.reload()
    }
    return null
  };

  FederatedCatchAll.getInitialProps = async (ctx) => {
    const { err, req, res, AppTree, ...props } = ctx;

    if (err) {
      // TODO: Run getInitialProps for error page
      return { renderError: true, ...props };
    }

    if (!process.browser) {
      return { needsReload: true, ...props };
    }

    try {
      const matchedPage = await matchFederatedPage(remotes, ctx.asPath);

      const remote =
        matchedPage && matchedPage.value && matchedPage.value.remote;
      const mod = matchedPage && matchedPage.value && matchedPage.value.module;

      if (!remote || !mod) {
        // TODO: Run getInitialProps for 404 page
        return { render404: true, ...props };
      }

      console.log("loading exposed module", mod, "from remote", remote);
      try {
        if (!window[remote].__initialized) {
          window[remote].__initialized = true;
          await window[remote].init(__webpack_share_scopes__.default);
        }
      } catch (initErr) {
        console.log("initErr", initErr);
      }
      console.log("finding remote", remote);
      const FederatedPage = await window[remote]
        .get(mod)
        .then((factory) => factory().default);
      if (!FederatedPage) {
        // TODO: Run getInitialProps for 404 page
        return { render404: true, ...props };
      }

      const modifiedContext = {
        ...ctx,
        query: matchedPage.params,
      };
      const federatedPageProps =
        (await (FederatedPage.getInitialProps &&
          FederatedPage.getInitialProps(modifiedContext))) || {};
      return { ...federatedPageProps, FederatedPage };
    } catch (err) {
      console.log("err", err);
      // TODO: Run getInitialProps for error page
      return { renderError: true, ...props };
    }
  };

  return FederatedCatchAll
}

module.exports = {
  createFederatedCatchAll,
};
