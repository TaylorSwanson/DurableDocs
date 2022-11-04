
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
    
    const newThread = await docs.create({
      title: "Lorem Ipsum",
      content: "Consectetur adipiscing elit",
      author: docs.ObjectId(),             // Anonymous, not set
      properties: {
        views: 0,
        isLocked: false,
        isStickied: false,
        createdAt: new Date()
      },
      replies: docs.List()
    });

    const reply = await docs.create({
      author: docs.ObjectId("111"),      // An existing user
      content: "Morbi ullamcorper dapibus metus, sed porttitor diam feugiat nec.",
      properties: {
        createdAt: new Date()
      }
    });

    let replyIds = newThread.refs.replies.documents().map(reply => reply.id);
    console.log(`Before: newThread reply ids: ${replyIds}`);

    await newThread.refs.replies.replies.addDoc(reply);

    replyIds = newThread.refs.replies.documents().map(reply => reply.id);
    console.log(`After: newThread reply ids: ${replyIds}`);

    return new Response(null, { status: 200 });
  }
};

// Export for wrangler
export { DurableDocData };
