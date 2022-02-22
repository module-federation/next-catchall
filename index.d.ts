import type { Context } from "react";

export function getOrCreateFederatedComponentCtx(options?: any): any;

export const federatedComponentsContext: Context<any>;

export function matchFederatedPage(remotes: string[], path: string): any;

export function createFederatedCatchAll(remotes: string[], ErrorComponent?: () => any, NotFoundComponent?: () => any): any;

export function federatedComponent(remote: string, module: string, shareScope = "default")