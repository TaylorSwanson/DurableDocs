
# DurableDocs (Alpha)

**This package is in active development and the API is subject to change**.
DurableDocs is currently being extracted from a larger project into a standalone
module.


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

DurableDocs is a document abstraction on top of CloudFlare's Durable Objects
platform.

Useful in applications where:
- Data can be split into a large number of individual documents
- Documents are individually relatively small ( < 128KiB)
- Single documents are used less than ~100 times/second

Building large applications is possible with careful planning, not unlike any
application that uses Durable Objects extensively.  Other Durable Objects and
Workers that you write can interact with DurableDocs via its methods.


# API Example

Somewhere in a CloudFlare worker or Durable Object instance:
```ts
// Typescript

import { DurableDocs, DurableDocData } from "durabledocs";

// All DurableDocs instances access the same data if passed the same namespace
// env.Durable_Doc_Data is of type DurableObjectNamespace
const docs = new DurableDocs(env.Durable_Doc_Data);

const newThread = await docs.create({
  title: "Lorem Ipsum",
  content: "Consectetur adipiscing elit",
  author: DurableDocs.ObjectId,
  properties: {
    views: 0,
    isLocked: false,
    isStickied: false,
    createdAt: new Date()
  }
  replies: DurableDocs.List
});

const reply = await docs.create({
  author: DurableDocs.ObjectId,
  content: "Morbi ullamcorper dapibus metus, sed porttitor diam feugiat nec.",
  properties: {
    createdAt: new Date()
  }
});

await newThread.refs.replies.add(reply);
```

Later:
```ts
const replyId = "12345bca";
const replyParents = await docs.get(replyId).parents();

console.log("This post is referenced in these threads:");
for await (const parentThread of replyParents) {
  const content = await parentThread.data();
  console.log(content);
}
```

Output:
```
This post is referenced in these threads:
{
  title: "Lorem Ipsum",
  content: "Consectetur adipiscing elit",
  author: "54321abc",
  properties: {
    views: 5,
    isLocked: false,
    isStickied: false,
    createdAt: "2022-10-01T18:19:01.595Z"
  }
  replies: ["12345bca"]
}
```

