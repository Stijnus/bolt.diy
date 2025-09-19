import type { PromiseFsClient } from 'isomorphic-git';

declare module '@isomorphic-git/lightning-fs' {
  interface LightningFSOptions {
    wipe?: boolean;
    fileDbName?: string;
    dirDbName?: string;
  }

  export default class LightningFS {
    constructor(name?: string, options?: LightningFSOptions);
    promises: PromiseFsClient['promises'];
  }
}
