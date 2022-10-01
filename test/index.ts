
/**
 * CloudFlare worker that implements the Durable Documents store. This is used
 * locally for development and testing.
 */

import { DurableDocs, DurableDocData } from "../src";

type Env = {
  DURABLE_DOC_DATA: DurableObjectNamespace,
}

// Worker entrypoint for development/testing
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const docs = new DurableDocs(env.DURABLE_DOC_DATA);
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
  },
  DurableDocData
};
