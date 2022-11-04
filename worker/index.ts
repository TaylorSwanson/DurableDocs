
/**
 * CloudFlare worker that implements the Durable Documents store. This is used
 * locally for development and testing.
 */

import Document from "../src/Document";
import { DurableDocs, DurableDocData } from "../src/DurableDocs";
import List from "../src/List";

type Env = {
  DURABLE_DOC_DATA: DurableObjectNamespace,
  DURABLE_DOC_KV: KVNamespace
}

// Worker entrypoint for development
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const docs = new DurableDocs(env.DURABLE_DOC_DATA, env.DURABLE_DOC_KV);

    const user = await docs.create({
      username: "ExampleUser123",
      website: "example.com",
      createdAt: new Date()
    })
    // Anonymous post
    const post = await docs.create({
      name: "Test post",
      // Anonymous, no author set;
      author: docs.ObjectId(),
      replies: docs.List()
    });
    // User replies to post
    const reply = await docs.create({
      content: "Replied to post",
      author: user
    });

    console.log("[1] Number of replies: ", (post.refs.replies as List).size());

    // Associate reply to post
    await (post.refs.replies as List).addDoc(reply);

    console.log("[2] Number of replies: ", (post.refs.replies as List).size());

    // Get username of each person who replied
    const usernames: string[] = [];
    for await (const reply of (post.refs.replies as List).documents()) {
      usernames.push((await reply.refs.author.data()).username);
    }

    return new Response(null, { status: 200 });
  }
};

// Export for wrangler
export { DurableDocData };
