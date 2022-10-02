
/**
 * An Index can be accessed far more quickly than a standard List, and is
 * suitable for fast access of items which are not added or removed frequently.
 */
export default class Index {

  private kvNamespace: KVNamespace;
  private indexName: string;

  constructor(kvNamespace: KVNamespace, indexName: string) {
    this.kvNamespace = kvNamespace;
    this.indexName = indexName;
  }
};
