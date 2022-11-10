
/**
 * CloudFlare worker that implements the Durable Documents store. This is used
 * locally for development and testing.
 */

import { List, ObjectId } from "../src";
import { DurableDocData, DurableDocs } from "../src/DurableDocs";

type Env = {
  DURABLE_DOC_DATA: DurableObjectNamespace
}

// Worker entrypoint for development
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const docs = new DurableDocs(env.DURABLE_DOC_DATA);

    const user = await docs.create({
      username: "ExampleUser123",
      website: "example.com",
      createdAt: new Date()
    })
    // Anonymous post
    const post = await docs.create({
      name: "Test post",
      // Anonymous, no author set;
      author: new ObjectId(),
      replies: new List()
    });
    // User replies to post
    const reply = await docs.create({
      content: "Replied to post",
      author: user
    });

    console.log("[1] Number of replies: ", await (post.refs.replies as List).size());

    // Associate reply to post
    await (post.refs.replies as List).addDoc(reply);

    console.log("[2] Number of replies: ", await (post.refs.replies as List).size());

    // Get username of each person who replied
    const usernames: string[] = [];
    for await (const reply of (post.refs.replies as List).documents()) {
      usernames.push((await reply.refs.author.data()).username);
    }

    console.log("[3] Usernames: ", usernames);

    return new Response(null, { status: 200 });
  }
};

// Export for wrangler
export { DurableDocData };
