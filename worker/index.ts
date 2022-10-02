
/**
 * CloudFlare worker that implements the Durable Documents store. This is used
 * locally for development and testing.
 */

import { DurableDocs, DurableDocData } from "../src/DurableDocs";

type Env = {
  DURABLE_DOC_DATA: DurableObjectNamespace,
  DURABLE_DOC_KV: KVNamespace
}

// Worker entrypoint for development
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const docs = new DurableDocs(env.DURABLE_DOC_DATA, env.DURABLE_DOC_KV);
    const newDoc = await docs.create({
      name: "Document One",
      numbers: 1234,
      otherDoc: DurableDocs.ObjectId,
      users: {
        admins: DurableDocs.List,
        members: DurableDocs.List
      }
    });

    return new Response(null, { status: 200 });
  }
};

// Export for wrangler
export { DurableDocData };
