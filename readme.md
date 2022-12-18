
# DurableDocs (Work in Progress)
## This package is not suitable for use at this time!

**It is currently being extracted from a larger project to a standalone
package.**

DurableDocs is a document abstraction on top of CloudFlare's Durable Objects
platform.

[![GitHub license](https://img.shields.io/github/license/TaylorSwanson/DurableDocs?style=flat-square)](https://github.com/TaylorSwanson/DurableDocs/blob/main/LICENSE)
![npm](https://img.shields.io/npm/v/durabledocs?style=flat-square)

```ts
// Example "forum"

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
  author: await docs.Document(),
  replies: await docs.List()
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
for await (const reply of await (post.refs.replies as List).documents()) {
  usernames.push((await reply.refs.author.data()).username);
}

console.log("[3] Usernames: ", usernames);

```

## Installation
**This package is in active development and the API is subject to change!**
It is currently being extracted from a larger project to a standalone module.

```sh
npm i durabledocs
```

## Features
Keep track of your Durable Objects!

- Behaves similar to a document database
- Easily link documents together
- Optional garbage collection of unused/orphaned documents
- Iteratively process documents to keep memory usage low and prevent eviction


### Wishlist / Planned Features
- Simple document index for scans and queries
- Expiring documents
- Unlimited-sized documents (best for data, not blob file storage!)
- Document collections
- Reference non-DurableDocs objects from within DurableDocs objects
- Custom functions for custom document behavior
- Transactions

## Use Cases
Useful in applications where:
- Data can be split into a large number of individual documents
- Documents are individually relatively small ( < 128KiB)
- Single documents are used less than ~100 times/second

Building large applications is possible with careful planning, not unlike any
application that uses Durable Objects extensively.  Other Durable Objects and
Workers that you write can interact with DurableDocs via its methods.

# Configuration
The `DurableDocData` class is exported from the main package. Re-export it in
your worker's main entrypoint:
```ts
// src/worker.ts
import { DurableDocs, DurableDocData } from "durabledocs";

type Env = {
  DURABLE_DOC_DATA: DurableObjectNamespace
}

// Worker entrypoint for development
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const docs = new DurableDocs(env.DURABLE_DOC_DATA, env.DURABLE_DOC_KV);
    const newDoc = await docs.create({
      name: "Document One",
      numbers: 1234,
      otherDoc: await docs.Document(),
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
```
```toml
# wrangler.toml

name = "example-worker"
compatibility_date = "2022-10-01"
minify = true

main = "./src/worker.ts"

# Generate your own namespace called DURABLE_DOC_KV
# https://developers.cloudflare.com/workers/wrangler/workers-kv/#create-a-kv-namespace-with-wrangler
kv_namespaces = [
  { binding = "DURABLE_DOC_KV", id = "<Your KV Namespace>" }
]

[durable_objects]
  bindings = [
    { name = "DURABLE_DOC_DATA", class_name = "DurableDocData" }
  ]

[[migrations]]
  tag = "v1" # Should be unique for each entry
  new_classes = ["DurableDocData"]
```

# General example
Creating documents, adding them to other documents, and accessing values:
```ts
// Typescript

import { DurableDocs, DurableDocData } from "durabledocs";

// All DurableDocs instances access the same data if passed the same namespace
// env.DURABLE_DOC_DATA is of type DurableObjectNamespace
const docs = new DurableDocs(env.DURABLE_DOC_DATA, env.DURABLE_DOC_KV);
    
const newThread = await docs.create({
  title: "Lorem Ipsum",
  content: "Consectetur adipiscing elit",
  author: await docs.document(),             // Anonymous, not set
  properties: {
    views: 0,
    isLocked: false,
    isStickied: false,
    createdAt: new Date()
  },
  replies: docs.List()
});

const reply = await docs.create({
  author: await docs.Document("111"),         // An existing user
  content: "Morbi ullamcorper dapibus metus, sed porttitor diam feugiat nec.",
  properties: {
    createdAt: new Date()
  }
});
// reply.id == "12345bca"

let replyIds = await (newThread.refs.replies as List).ids();
console.log(`Before: newThread reply ids: ${replyIds}`);

await newThread.refs.replies.addDoc(reply);

replyIds = await (newThread.refs.replies as List).ids();
console.log(`After: newThread reply ids: ${replyIds}`);

```

Output:
```
Before: newThread reply ids: []
After: newThread reply ids: ["12345bca"]
```

Later:
```ts
const replyId = "12345bca";
const replyParents = await docs.get(replyId).parents();

console.log(`This post is referenced in ${ replyParents.length } threads:`);
for await (const parentThread of replyParents.documents()) {
  const content = await parentThread.data();
  console.log({
    id: parentThread.id,
    content
  });
}

console.log(`Thread`);
```

Output:
```
This post is referenced in 1 threads:
{
  id: "00000823756911274871238",
  content: {
    title: "Lorem Ipsum",
    content: "Consectetur adipiscing elit",
    author: undefined,
    properties: {
      views: 5,
      isLocked: false,
      isStickied: false,
      createdAt: "2022-10-01T18:19:01.595Z"
    }
    replies: ["12345bca"]
  }
}
```
