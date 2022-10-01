
// Main entrypoint for store

import ObjectId from "./ObjectId";
import Document from "./Document";

// Used at a high level to access the database

export class DurableDocs {
  // Reference to the DO
  private DONamespace: DurableObjectNamespace;
  
  constructor(storeNamespace: DurableObjectNamespace) {
    if (!(storeNamespace instanceof DurableDocData)) {
      throw new Error("ObjectStore must be initialized with a reference to an ObjectStoreData Namespace");
    }

    this.DONamespace = storeNamespace;
  }

  /**
   * Create a new document in the database.
   * @param objectData Content to store.
   * @returns The newly created document.
   */
  async create(objectData?: any): Promise<Document> {
    // TODO make new DO instance and then create the document for it
    const newDOId = this.DONamespace.newUniqueId();
    const document = new Document(newDOId, this.DONamespace);

    return document.init();
  }

  /**
   * Get a document already stored in the database.
   * @param getId Id of existing document.
   * @returns The existing document.
   */
  async get(getId: string | ObjectId | Document): Promise<Document> {
    // Extract the id string if necessary
    let idString: string;
    if (getId instanceof ObjectId || getId instanceof Document) {
      idString = getId.id;
    } else {
      idString = getId;
    }

    const DOId = this.DONamespace.idFromString(idString);
    const document = new Document(DOId, this.DONamespace);

    return document.init();
  }
}

/**
 * DurableObject class for Durable Document content. This class should be
 * referenced as a binding in your wrangler.toml file.
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
