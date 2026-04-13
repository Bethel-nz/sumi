declare global {
  var __SUMI_STARTED: boolean | undefined;
  // Fallback — overridden by the project-root sumi.d.ts generated at dev time
  type MiddlewareName = string;
}

export {};
