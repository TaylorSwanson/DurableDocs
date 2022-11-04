
// Main entrypoint for store

import ObjectId from "./ObjectId";
import Document from "./Document";
import List from "./List";

export class DurableDocs {
  
  /**
   * Durable Object class namespace - must be compatible with DurableDocs,
   * should refer to a DurableObject class provided by DurableDocs package.
   * 
   * @see DurableDocData
   */
  private doNamespace: DurableObjectNamespace;
  private kvNamespace: KVNamespace;
  
  constructor(storeNamespace: DurableObjectNamespace, kvNamespace: KVNamespace) {
    this.doNamespace = storeNamespace;
    this.kvNamespace = kvNamespace;
  }
  
  /**
   * Placeholder reference for a single document id in a new document, default
   * empty
   * @see ObjectId
   */
  ObjectId(id?: string): ObjectId {
    if (!id) return new ObjectId();
    return new ObjectId(id);
  }
  /**
   * Placeholder reference for a list of documents in a new document, default
   * empty
   * @see List
   */
  List(id?: string): List {
    if (!id) return new List();
    return new List(this.doNamespace, id);
  }

  /**
   * Create and save a new document
   * @param objectData Content to store
   * @returns The newly created document
   */
  async create(objectData?: { [key: string]: any }): Promise<Document> {
    const newDoId = this.doNamespace.newUniqueId();
    const document = new Document(this.doNamespace, newDoId);

    return document.init();
  }

  /**
   * @param id Id of existing document
   * @returns The document at that id
   */
  async get(id: string): Promise<Document> {
    const doId = this.doNamespace.idFromString(id);
    const document = new Document(this.doNamespace, doId);

    return document.init();
  }
}

/**
 * DurableObject class definition for DurableDocs database
 * This class should be referenced as a binding in your wrangler.toml file
 */
export class DurableDocData {
  state: DurableObjectState;
  env: any;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    // Choose a handler function depending on the request method
    const handlerResponse = ({
      // "GET": getHandler,
      // "POST": postHandler,
      // "PATCH": patchHandler,
      // "DELETE": deleteHandler
    })[request.method](this.state, this.env, request);

    return handlerResponse ?? new Response(null, { status: 405 });
  }
}
