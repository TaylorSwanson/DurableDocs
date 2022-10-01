
# DurableDocs Alpha

**This package is in active development and the API is subject to change**.
DurableDocs is currently being extracted from a larger project into a standalone
module.

DurableDocs is a simple document database abstraction on top of CloudFlare's
Durable Objects platform.

Documents are JS objects, which may contain references to other documents via
provided DurableDocs APIs, such as `List` and `ObjectId`. These APIs provide
automation and methods to manage large number of documents, including built-in
garbage collection where desired.

# API Example
CloudFlare Worker: 
```ts
// index.ts

import { DurableDocs, DurableDocData } from "durabledocs";

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const docs = new DurableDocs(env.Durable_Doc_Data);
    const chatRoom = await docs.create({
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
``


## Features

- Document-style database
- Lives entirely in Durable Objects
- Garbage collection for orphaned documents


### Limitations

This package may not suit your entire use case, especially if you have a larger
application.


