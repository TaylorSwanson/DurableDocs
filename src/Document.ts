
// Used to pass around references to DOs without loading data until needed

import ObjectId from "./ObjectId";
import List from "./List";
import { deleteDO, getFromDO, setDOContent } from "./utils";

/**
 * Used for ref type.
 * Recursive, allows chaining, but the end of the chain will always be a class.
 */
// type ChainItem = { [key: string]: ChainItem | List | ObjectId };
type ChainItem = { [key: string]: any };

/**
 * Returned when generating content on write
 */
type ContentRefDef = {
  storeContent: { [key: string]: any },
  refs: {
    idKeys: string[],
    listKeys: string[],
  }
};

export default class Document {
  public id: string;
  
  // References to DO
  private doNamespace: DurableObjectNamespace;
  private doStub?: DurableObjectStub;

  /**
   * List of parents who own this object
   */
  public parents: List;

  /**
   * Chainable list of properties that provide access to the Document's
   * non-primitive types. Populated on init() and update().
   */
  public refs: ChainItem = {};

  /**
   * Flag for whether this instance has had its minimum content loaded.
   */
  private initialized = false;

  /**
   * Flag for whether parent tracking and orphan cleanup is enabled.
   */
  private trackParents = true;

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
    id: string | DurableObjectId,
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
    this.refs = {} as ChainItem;

    // Add Lists from ids
    this.metadata?.listKeys?.forEach(listKey => {
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
        refPath = refPath[p] as ChainItem;

        dataPath = dataPath?.[p];
      });
    });
    // Add Documents from ids
    this.metadata?.idKeys?.forEach(idKey => {
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
        refPath = refPath[p] as ChainItem;
  
        dataPath = dataPath?.[p];
      });
    });
  }

  /**
   * Find types in content that might be Lists or Documents or ObjectIds,
   * then replace them with strings representing them. Also generate object
   * that maps the key path to type for buildRefs() function on init.
   * @param target Object to find classes in and mark down type paths.
   * @param path Path in the parent object that this object is working in.
   * @returns ContentRefDef type object, structured for easy parsing.
   */
  private placeTypesAndRefs(
    target: { [key: string]: any },
    path = ""
  ): ContentRefDef {
    const idKeys: string[] = [];
    const listKeys: string[] = [];

    if (!target) target = {};

    // Don't create side-effects
    let parseContent = structuredClone(target);

    // Recurse into objects, convert objects to literals and map type paths
    const keys = Object.keys(parseContent);
    keys.forEach(key => {
      // Generate dot notation to this path
      const keyPath = [path, key].filter(p => p?.length).join(".");

      if (typeof parseContent[key] === "object") {
        if (parseContent[key] instanceof Date) {
          parseContent[key] = Date.toString()
        } else if (
          // Check if these are custom DurableDocs classes
          parseContent[key] instanceof List ||
          parseContent[key] instanceof Document ||
          parseContent[key] instanceof ObjectId
        ) {
          // Write id of the instance, prevent [Object object] when stringified
          // Write nulls to places where the object is not instantiated
          parseContent[key] = parseContent[key].id ?? null;

          // Store path to this class type in dot notation for later parsing
          if (parseContent instanceof List) {
            listKeys.push(keyPath);
          } else {
            idKeys.push(keyPath);
          }
        } else {
          // Recurse into the object at this key
          const { storeContent, refs } = this.placeTypesAndRefs(parseContent[key], keyPath);
          // Include those results into the larger result
          idKeys.push(...refs.idKeys);
          listKeys.push(...refs.listKeys);
          // Merge in new values
          parseContent[key] = storeContent;
        }
      }
    });

    return {
      storeContent: parseContent,
      refs: {
        idKeys,
        listKeys
      }
    };
  };

  /**
   * Replace all content in this Document. Removess all keys that are not
   * provided.
   * @param content Content to set at this document
   */
  async set(content: { [key: string]: any }) {
    if (!this.doNamespace || !this.doStub) {
      throw new Error("Cannot init Document that has no attached DO");
    }

    const documentStoreContent = this.placeTypesAndRefs(content);

    // TODO
    await setDOContent(this.doStub, documentStoreContent);

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

  /**
   * Delete the DO holding this Document
   */
  async delete(): Promise<void> {
    if (!this.doNamespace || !this.doStub) {
      throw new Error("Cannot delete Document that has no attached DO");
    }
    await this.parents.delete();
    await deleteDO(this.doStub);
  }
}
