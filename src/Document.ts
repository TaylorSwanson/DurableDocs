
// Used to pass around references to DOs without loading data until needed

import ObjectId from "./ObjectId";
import List from "./List";
import { getFromDO } from "./utils";

// Recursive, allows chaining
type PropChainItem = List | ObjectId | { [key: string]: PropChainItem }

export default class Document {
  // Basic properties
  public id: string;
  // List of parents who own this object
  public parents: List;
  /**
   * Chainable list of properties that provide access to the Document's
   * non-primitive types. Populated on init() and update().
   */
  public refs: { [key: string]: PropChainItem } = {};

  /**
   * Flag for whether this instance has had its minimum content loaded
   */
  private initialized = false;
  // References to DO
  private doNamespace: DurableObjectNamespace;
  private doStub: DurableObjectStub;

  /**
   * Document data currently stored in memory from the last init() call, may be
   * stale.
   */
  private localdata: { [key: string]: any };

  /**
   * In-memory metadata associated with localdata, loaded from last init() call,
   * may be stale but will be in sync with localdata.
   */
  private metadata: {
    // Dot-notation strings pointing to which keys are of which type, if any
    listKeys: string[],
    idKeys: string[]
  };

  constructor(
    doId: DurableObjectId,
    doNamespace: DurableObjectNamespace
  ) {
    this.id = doId.toString();

    // DurableObject references
    this.doNamespace = doNamespace;
    this.doStub = this.doNamespace.get(doId);

    // Initialization
    this.localdata = {};
    this.metadata = {
      listKeys: [],
      idKeys: []
    };
    this.parents = new List(doNamespace);
  }

  /**
   * Turns local meta prop into local refs object that can be accessed publicly.
   * Refs refers to an object's embedded classess that can be accessed for
   * direct usage and manipulation. E.g., adding an item to a List prop.
   */
  private buildRefs(): void {
    this.refs = {};
    this.metadata.listKeys.forEach(listKey => {

    });
    this.metadata.idKeys.forEach(idKey => {

    });
  }

  /**
   * Load the Document's content from storage
   * @returns The populated Document object.
   */
  async init(): Promise<Document> {
    if (this.initialized) return this;
    this.initialized = true;
    
    // Load full DO content
    const data = await getFromDO(this.doStub);
    // Parse the data
    this.metadata = data.meta ?? {};
    this.localdata = data.data ?? {};

    // Update public refs
    this.buildRefs();

    return this;
  }

  /**
   * Access the content of the document, loads the document data to memory if
   * not already initialized.
   * @returns Stored contents of the Document.
   */
  async data(): Promise<{ [key: string]: any }> {
    if (!this.initialized) {
      await this.init();
    }
    return structuredClone(this.localdata);
  }
}
