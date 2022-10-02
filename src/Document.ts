
// Used to pass around references to DOs without loading data until needed

import ObjectId from "./ObjectId";
import List from "./List";
import { getFromDO } from "./utils";

// Recursive, allows chaining
type PropChainItem = { [key: string]: PropChainItem } | List | ObjectId

export default class Document {
  // Basic properties
  public id: string;
  // List of parents who own this object
  public parents: List;
  /**
   * Chainable list of properties that provide access to the Document's
   * non-primitive types. Populated on init() and update().
   */
  public refs: PropChainItem = {};

  /**
   * Flag for whether this instance has had its minimum content loaded
   */
  private initialized = false;
  // References to DO
  private doNamespace: DurableObjectNamespace;
  private doStub?: DurableObjectStub;

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
    doNamespace: DurableObjectNamespace,
    id: string | DurableObjectId
  ) {
    // DurableObject references
    this.id = id.toString();
    this.doNamespace = doNamespace;

    // Initialization
    this.localdata = {};
    this.metadata = {
      listKeys: [],
      idKeys: []
    };
    // Empty list
    this.parents = new List(this.doNamespace);

    // Get stub if provided
    if (this.id && this.doNamespace) {
      const doId = this.doNamespace.idFromString(this.id);
      this.doStub = this.doNamespace.get(doId);
    }
  }

  /**
   * Turns local meta prop into local refs object that can be accessed publicly.
   * Refs refers to an object's embedded classess that can be accessed for
   * direct usage and manipulation. E.g., adding an item to a List prop.
   */
  private buildRefs(): void {
    // Clear any old refs
    this.refs = {} as PropChainItem;

    // Add Lists from ids
    this.metadata.listKeys.forEach(listKey => {
      // Replicate structure defined by the path and put a list at the end
      const path = listKey.split(".");
      
      // Do both at the same time:
      // - Get the List id at the end of the path, if set
      // - Build refs up to the List
      let dataPath = this.localdata;
      let refPath = this.refs;
      path.forEach((p, idx) => {
        if (idx >= path.length - 1) {
          // We've reached the end of the chain
          const listId: string = dataPath?.[p];
          refPath[p] = new List(this.doNamespace, listId);

          return;
        }

        // Create parent paths as needed
        if (!refPath[p]) refPath[p] = {};
        refPath = refPath[p];

        dataPath = dataPath?.[p];
      });
    });
    // Add Documents from ids
    this.metadata.idKeys.forEach(idKey => {
      // Replicate structure defined by the path and put a list at the end
      const path = idKey.split(".");
      
      // Do both at the same time:
      // - Get the document id at the end of the path, if set
      // - Build refs up to the ObjectId
      let dataPath = this.localdata;
      let refPath = this.refs;
      path.forEach((p, idx) => {
        if (idx >= path.length - 1) {
          // We've reached the end of the chain
          const documentId: string = dataPath?.[p];
          if (!documentId) return;

          refPath[p] = new Document(this.doNamespace, documentId);

          return;
        }

        // Create parent paths as needed
        if (!refPath[p]) refPath[p] = {};
        refPath = refPath[p];
  
        dataPath = dataPath?.[p];
      });
    });
  }

  /**
   * Replace all content in the document
   * @param content Content to set at this document
   */
  async set(content: { [key: string]: any }) {
    if (!this.doNamespace || !this.doStub) {
      throw new Error("Cannot init Document that has no attached DO");
    }

    const toStore = structuredClone(content);
    // TODO find types in content that might be Lists or Documents or ObjectIds



    this.initialized = false;
    return this.init();
  }

  /**
   * Load the Document's content from storage
   * @returns The populated Document object.
   */
  async init(): Promise<Document> {
    if (!this.doNamespace || !this.doStub) {
      throw new Error("Cannot init Document that has no attached DO");
    }
    if (this.initialized) return this;
    
    // Load full DO content
    const data = await getFromDO(this.doStub);
    // Store contents
    this.metadata = data.meta ?? {};
    this.localdata = data.data ?? {};
    
    // Update public refs
    this.buildRefs();
    this.initialized = true;
    
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
    // TODO provide list contents on list props
    const parsed = structuredClone(this.localdata);

    return parsed;
  }
}
