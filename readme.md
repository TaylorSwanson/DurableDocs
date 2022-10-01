
# DurableDocs (Alpha)

[![GitHub license](https://img.shields.io/github/license/TaylorSwanson/DurableDocs?style=flat-square)](https://github.com/TaylorSwanson/DurableDocs/blob/main/LICENSE)
![npm](https://img.shields.io/npm/v/durabledocs?style=flat-square)

**This package is in active development and the API is subject to change**.
It is currently being extracted from a larger project into a standalone
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


# API Documentation

## DurableDocs
The `DurableDocs` constructor must be passed a reference to the
`DurableObjectNamespace` corresponding with the `DurableDocData` class's binding
in the Worker.

Your `wrangler.toml` file for your worker might look something like this:

```toml
name = "example"
compatibility_date = "2022-10-01"
minify = true

main = "./src/index.ts"

[durable_objects]
  bindings = [
    { name = "DURABLE_DOC_DATA", class_name = "DurableDocData" }
  ]

[[migrations]]
  tag = "v1" # Should be unique for each entry
  new_classes = ["DurableDocData"]
```

However you choose to name the `DurableDocData` class binding, you must pass it
back to the `DurableDocs` constructor:
```ts
import { DurableDocs } from "durabledocs";

// Pass your binding from the environment provided to your worker to contructor.
// "DURABLE_DOC_DATA" is the name of the binding in wrangler.toml:
const docs = new DurableDocs(env.DURABLE_DOC_DATA);
```


### Creating documents


# API Example

Creating documents, adding them to other documents, and accessing values:
```ts
// Typescript

import { DurableDocs, DurableDocData } from "durabledocs";

// All DurableDocs instances access the same data if passed the same namespace
// env.DURABLE_DOC_DATA is of type DurableObjectNamespace
const docs = new DurableDocs(env.DURABLE_DOC_DATA);

const newThread = await docs.create({
  title: "Lorem Ipsum",
  content: "Consectetur adipiscing elit",
  author: DurableDocs.ObjectId,             // Anonymous, not set
  properties: {
    views: 0,
    isLocked: false,
    isStickied: false,
    createdAt: new Date()
  }
  replies: DurableDocs.List
});

const reply = await docs.create({
  author: DurableDocs.ObjectId("111"),      // An existing user
  content: "Morbi ullamcorper dapibus metus, sed porttitor diam feugiat nec.",
  properties: {
    createdAt: new Date()
  }
});

let replyIds = newThread.refs.replies.documents().map(reply => reply.id);
console.log(`Before: newThread reply ids: ${ replyIds }`);

await newThread.refs.replies.add(reply);
// reply.id == "12345bca"

replyIds = newThread.refs.replies.documents().map(reply => reply.id);
console.log(`After: newThread reply ids: ${ replyIds }`);
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
