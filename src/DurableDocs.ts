
// Main entrypoint for store

import Document from "./Document";

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
  // ObjectId(id?: string): ObjectId {
  //   if (!id) return new ObjectId();
  //   return new ObjectId(id);
  // }
  /**
   * Placeholder reference for a list of documents in a new document, default
   * empty
   * @see List
   */
  // List(id?: string): List {
  //   if (!id) return new List();
  //   return new List(this.doNamespace, id);
  // }

  /**
   * Create and save a new document
   * @param objectData Content to store
   * @returns The newly created document
   */
  async create(objectData?: { [key: string]: any }): Promise<Document> {
    if (!objectData) objectData = {};

    const newDoId = this.doNamespace.newUniqueId();
    const document = new Document(this.doNamespace, newDoId);

    return document.init(objectData);
  }

  /**
   * @param id Id of existing document
   * @returns The document at that id
   */
  async get(id: string): Promise<Document> {
    const doId = this.doNamespace.idFromString(id);
    const document = new Document(this.doNamespace, doId);

    return document.load();
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

  private async postHandler(state: DurableObjectState, env, request: Request) {
    // Initialize this storage object
    const data = (await request.json()) as { 
      type: "list" | "document",
      payload: { [key: string]: any }
    };

    if (!["list", "document"].includes(data.type)) {
      throw new Error(`DurableDocs instance must be type "list" or "document"`)
    }

    const exists = await state.storage.get("type") as string | undefined;
    if (exists) {
      throw new Error(`DurableDocs instance exists already`);
    }

    await state.storage.put("type", data.type);
    if (data.payload) {
      await state.storage.put("data", data.payload);
    }

    return new Response(null, { status: 201 });
  }

  private async getHandler(state: DurableObjectState, env, request: Request) {
    const data = await state.storage.get("data");
    return new Response(data ? JSON.stringify(data) : null);
  }

  private async putHandler(state: DurableObjectState, env, request: Request) {
    const data = await request.json();
    await state.storage.put("data", data);
    return new Response(null, { status: 201 });
  }

  private async deleteHandler(state: DurableObjectState, env, request: Request) {
    await state.storage.deleteAll();
    return new Response(null, { status: 200 });
  }

  async fetch(request: Request): Promise<Response> {
    // Choose a handler function depending on the request method
    const handlerResponse = ({
      "POST": this.postHandler,
      "GET": this.getHandler,
      "PUT": this.putHandler,
      "DELETE": this.deleteHandler
    })[request.method](this.state, this.env, request);

    return handlerResponse ?? new Response(null, { status: 405 });
  }
}
