
// Used to pass around references to DOs as document-like objects

import {
  List,
  ObjectId
} from ".";

import { 
  deleteDO,
  getFromDO,
  initializeDO,
  setDOContent,
  updateDOContent
} from "./utils";

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
  data: { [key: string]: any },
  refs: {
    idKeys: string[],
    listKeys: string[],
  },
  parentListId?: string
};

export class Document {
  public id: string;
  
  // References to DO
  private doNamespace: DurableObjectNamespace;
  private doStub: DurableObjectStub;

  /**
   * List of parents who own this object
   */
  private parentList?: List;

  /**
   * Chainable list of properties that provide access to the Document's
   * non-primitive types. Populated on init() and update().
   */
  public refs: ChainItem = {};

  /**
   * Tracks whether the document is not initialized (has never created a DO)
   */
  private isNull = false;

  /**
   * Flag for whether parent tracking and orphan cleanup is enabled.
   */
  private trackParents = true;

  /**
   * Document data currently stored in memory from the last init() call, may be
   * stale.
   */
  private localData: { [key: string]: any };

  /**
   * In-memory metadata associated with localdata, loaded from last init() call,
   * may be stale but will be in sync with localdata.
   */
  public metadata: {
    // Dot-notation strings pointing to which keys are of which type, if any
    listKeys: string[],
    idKeys: string[]
  };

  constructor(
    doNamespace: DurableObjectNamespace,
    id?: string
  ) {
    // DurableObject references
    this.doNamespace = doNamespace;

    // Initialization
    this.localData = {};
    this.metadata = {
      listKeys: [],
      idKeys: []
    };

    if (id && this.doNamespace) {
      // Get existing stub
      this.id = id;
      const doId = this.doNamespace?.idFromString(this.id);
      this.doStub = this.doNamespace.get(doId);
    } else {
      // Initialize by creating a new DO
      const newDoId = this.doNamespace.newUniqueId();
      this.id = newDoId.toString();
      this.doStub = this.doNamespace.get(newDoId);
    }
  }

  /**
   * Turns local meta prop into local refs object that can be accessed publicly.
   * Refs prop refers to an object's embedded classess that can be accessed for
   * direct usage and manipulation. E.g., adding an item to a List prop.
   */
  private async buildRefs(): Promise<void> {
    // Clear any old refs
    this.refs = {} as ChainItem;

    // Add Lists from ids
    for await (const listKey of this.metadata?.listKeys) {
      // Replicate structure defined by the path and put a list at the end
      const path = listKey.split(".");

      // Do both at the same time:
      // - Get the List id at the end of the path, if set
      // - Build refs up to the List
      let dataPath = this.localData;
      let refPath = this.refs;

      for await (const p of path) {
        const idx = path.indexOf(p);

        if (idx >= path.length - 1) {
          // We've reached the end of the chain
          const listId: string = dataPath?.[p];
          const list = new List(this.doNamespace, listId);

          refPath[p] = await list.init();

          continue;
        }

        // Create parent paths as needed
        if (!refPath[p]) refPath[p] = {};
        refPath = refPath[p] as ChainItem;

        dataPath = dataPath?.[p];
      }
    }
    // Add Documents from ids
    for await (const idKey of this.metadata?.idKeys) {
      // Replicate structure defined by the path and put a Document at the end
      const path = idKey.split(".");
      
      // Do both at the same time:
      // - Get the Document id at the end of the path, if set
      // - Build refs up to the ObjectId
      let dataPath = this.localData;
      let refPath = this.refs;

      for await (const p of path) {
        const idx = path.indexOf(p);

        if (idx >= path.length - 1) {
          // We've reached the end of the chain
          const documentId: string = dataPath?.[p];
          if (!documentId) continue;

          const document = new Document(this.doNamespace, documentId);

          refPath[p] = await document.init();

          continue;
        }

        // Create parent paths as needed
        if (!refPath[p]) refPath[p] = {};
        refPath = refPath[p] as ChainItem;
  
        dataPath = dataPath?.[p];
      }
    };
  }

  /**
   * Find types in content that might be Lists or Documents or ObjectIds,
   * then replace them with strings representing them. Also generate object
   * that maps the key path to type for buildRefs() function on init.
   * @param target Object to find classes in and mark down type paths.
   * @param path Path in the parent object that this object is working in.
   * @returns ContentRefDef type object, structured for easy parsing.
   */
  private prepareStoreData(
    target: { [key: string]: any },
    path = ""
  ): ContentRefDef {
    const idKeys: string[] = [];
    const listKeys: string[] = [];

    let output: { [key: string]: any} = {};

    // Recurse into objects, convert objects to literals and map type paths
    const keys = Object.keys(target);
    keys.forEach(key => {
      // Generate dot notation to this path
      const keyPath = [path, key].filter(p => p?.length).join(".");
      if (typeof target[key] === "object") {
        if (target[key] instanceof Date) {
          output[key] = target[key].toString();
        } else if (
          // Check if these are custom DurableDocs classes
          target[key] instanceof List ||
          target[key] instanceof Document ||
          target[key] instanceof ObjectId
        ) {
          // Write id of the instance, prevent [Object object] when stringified
          // Write nulls to places where the object is not instantiated yet
          output[key] = target[key].id ?? null;

          // Store path to this class type in dot notation for later parsing
          if (target[key] instanceof List) {
            listKeys.push(keyPath);
          } else if (target) {
            idKeys.push(keyPath);
          }
        } else {
          // Recurse into the object at this key
          const { data, refs } = this.prepareStoreData(target[key], keyPath);
          // Include those results into the larger result
          idKeys.push(...refs.idKeys);
          listKeys.push(...refs.listKeys);
          // Merge in new values
          output[key] = data;
        }
      } else {
        output[key] = target[key];
      }
    });

    return {
      data: output,
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
  async set(content: { [key: string]: any }): Promise<Document> {
    if (!this.doNamespace || !this.doStub) {
      throw new Error("Cannot init Document that has no attached DO");
    }

    const setData = this.prepareStoreData(content);
    await setDOContent(this.doStub, setData);

    return this.load();
  }
  
  async update(content: { [key: string]: any }): Promise<Document> {
    if (!this.doNamespace || !this.doStub) {
      throw new Error("Cannot init Document that has no attached DO");
    }

    const setData = this.prepareStoreData(content);
    await updateDOContent(this.doStub, setData);

    return this.load();
  }

  async init(content?: { [key: string]: any }): Promise<Document> {
    if (!this.doNamespace || !this.doStub) {
      throw new Error("Cannot init Document that has no attached DO");
    }

    if (!content) content = {};

    const setData = this.prepareStoreData(content);

    const parentList = new List(this.doNamespace);
    await parentList.init();
    setData.parentListId = parentList.id;
    
    await initializeDO(this.doStub, "document", setData);
    
    this.parentList = parentList;
    return this.load();
  }

  /**
   * Load the Document's content from storage
   * @returns The populated Document object.
   */
  async load(): Promise<Document> {
    if (!this.doNamespace || !this.doStub) {
      throw new Error("Cannot init Document that has no attached DO");
    }
    
    // Load full DO content
    const data = await getFromDO(this.doStub);

    // Handle case where document was never initialized
    if (!data) {
      // Document was never initialized
      return this.init();
    }

    // Stored contents
    this.metadata = data.refs ?? {};
    this.localData = data.data ?? {};

    // Build list reference
    const parentList = new List(this.doNamespace, data.parentListId);
    this.parentList = await parentList.init();
    
    // Update public refs
    await this.buildRefs();
    
    return this;
  }

  /**
   * Access the content of the document without expanding lists
   * @returns Stored contents of the Document.
   */
  async rawData(): Promise<{ [key: string]: any } | null> {    
    await this.load();
    if (Object.getOwnPropertyNames(this.localData).length === 0) {
      return null;
    }
    return structuredClone(this.localData);
  }

  /**
   * Access the content of the document
   * @returns Stored contents of the Document with Lists converted to id arrays.
   */
  async data(): Promise<{ [key: string]: any } | null> {    
    await this.load();
    if (Object.getOwnPropertyNames(this.localData).length === 0) {
      return null;
    }

    const expandedData = structuredClone(this.localData);

    // Convert List ids to array of entry ids
    for await (const listKey of this.metadata?.listKeys) {
      // Replicate structure defined by the path and put a list at the end
      const path = listKey.split(".");

      // Do both at the same time:
      // - Get the List id at the end of the path, if set
      // - Build refs up to the List
      let dataPath = expandedData;
      let refPath = expandedData;
      for await (const p of path) {
        const idx = path.indexOf(p);

        if (idx >= path.length - 1) {
          // We've reached the end of the chain
          const listId: string = dataPath?.[p];
          let list = new List(this.doNamespace, listId);
          list = await list.init();

          refPath[p] = await list.ids();

          continue;
        }

        // Create parent paths as needed
        if (!refPath[p]) refPath[p] = {};
        refPath = refPath[p] as ChainItem;

        dataPath = dataPath?.[p];
      }
    }

    return expandedData;
  }

  /**
   * Returns List containing all documents that reference this Document
   */
  async parents(): Promise<List> {
    if (!this.doNamespace || !this.doStub) {
      throw new Error("Cannot init Document that has no attached DO");
    }
    
    await this.load();

    if (!this.parentList) {
      // Parent list was not set
      // Create it now
      const list = new List(this.doNamespace);
      await this.update({
        parents: await list.init()
      });
      this.parentList = list;
    }

    return this.parentList;
  }

  /**
   * Delete the DO holding this Document
   */
  async delete(): Promise<void> {
    if (!this.doNamespace || !this.doStub) {
      throw new Error("Cannot delete Document that has no attached DO");
    }
    if (this.parentList) {
      await this.parentList.delete();
    }
    await deleteDO(this.doStub);
  }
}
