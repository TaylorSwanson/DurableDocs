
// Main entrypoint for store

import Document from "./Document";

function isObject(item) {
  return (item && typeof item === "object" && !Array.isArray(item));
}

function mergeDeep(target, ...sources) {
  if (!sources.length) return target;
  const source = sources.shift();
  
  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, {
          [key]: {}
        });
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, {
          [key]: source[key]
        });
      }
    }
  }
  
  return mergeDeep(target, ...sources);
}

export class DurableDocs {
  /**
   * Durable Object class namespace - must be compatible with DurableDocs,
   * should refer to a DurableObject class provided by DurableDocs package.
   * 
   * @see DurableDocData
   */
  private doNamespace: DurableObjectNamespace;
  // private kvNamespace: KVNamespace;
  
  // constructor(storeNamespace: DurableObjectNamespace, kvNamespace: KVNamespace) {
  constructor(storeNamespace: DurableObjectNamespace) {
    this.doNamespace = storeNamespace;
    // this.kvNamespace = kvNamespace;
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

    const exists = await state.storage.get("initialized") as boolean;
    if (exists) {
      // This is an implementation error - this init is handled by DurableDocs
      throw new Error(`DurableDocs instance exists already`);
    }

    await state.storage.put({
      type: data.type,
      initialized: true
    });
    if (data.payload) {
      await state.storage.put("data", data.payload);
    }

    return new Response(null, { status: 201 });
  }

  private async patchHandler(state: DurableObjectState, env, request: Request) {
    const data = await request.json() as any;

    const stored = await state.storage.get(["initialized", "data"]);

    // Merge the data from the request on top of the stored data
    const mergedData = mergeDeep(stored.get("data") ?? {}, data);

    await state.storage.put({
      data: mergedData,
      initialized: true
    });

    return new Response(null, { status: 200 });
  }

  private async getHandler(state: DurableObjectState, env, request: Request) {
    const stored = await state.storage.get(["initialized", "data"]);

    // Don't return data if the doc has never been created
    const initialized = stored.get("initialized");
    if (!initialized) {
      return new Response(null, { status: 404 });
    }

    const data = stored.get("data");
    return new Response(data ? JSON.stringify(data) : "{}");
  }

  private async putHandler(state: DurableObjectState, env, request: Request) {
    const data = await request.json();

    await state.storage.put({
      data,
      initialized: true
    });
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
      "PATCH": this.patchHandler,
      "GET": this.getHandler,
      "PUT": this.putHandler,
      "DELETE": this.deleteHandler
    })[request.method](this.state, this.env, request);

    return handlerResponse ?? new Response(null, { status: 405 });
  }
}
