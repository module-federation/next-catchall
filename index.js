const React = require("react");
const createMatcher = require("feather-route-matcher").default;

async function matchFederatedPage(remotes, path) {
  if(!remotes) {console.error('No __REMOTES__ webpack global defined or no remotes passed to catchAll')}
  const maps = await Promise.all(
    remotes.map((remote) =>
      window[remote]
        .get("./pages-map")
        .then((factory) => ({ remote, config: factory().default }))
        .catch(() => null)
    )
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

function createFederatedCatchAll(remotes, ErrorComponent,NotFoundComponent) {
  const FederatedCatchAll = (initialProps) => {
    const [lazyProps, setProps] = React.useState({});

    const { FederatedPage, render404, renderError, needsReload, ...props } = {
      ...lazyProps,
      ...initialProps,
    };

    React.useEffect(async () => {
      if (needsReload) {
        const federatedProps = await FederatedCatchAll.getInitialProps(props);
        setProps(federatedProps);
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
      if(is404) {
        return NotFoundComponent ? React.createElement(NotFoundComponent, props) : React.createElement("h1", {}, "404 Not Found")
      } else {
        return null
      }
    }

    if (renderError) {
      return ErrorComponent ? React.createElement(ErrorComponent,props) : React.createElement("h1", {}, "Oops, something went wrong.");
    }

    if (FederatedPage) {
      return React.createElement(FederatedPage, props);
    }

    return null;
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

      const FederatedPage = await window[remote]
        .get(mod)
        .then((factory) => factory().default);
      console.log("FederatedPage", FederatedPage);
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

  return FederatedCatchAll;
}

module.exports = {
  matchFederatedPage,
  createFederatedCatchAll,
};
