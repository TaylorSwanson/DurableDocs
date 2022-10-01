
# DurableDocs

DurableDocs is a simple document database wrapper on top of CloudFlare's global
Durable Objects platform. It will provide a single Durable Object class to bind
to your worker as a 


## Features

- Document-style database
- Lives entirely in Durable Objects
- Garbage Collection for orphaned objects


## Disadvantages

There are a few reasons you may not want to use this abstraction layer:

- No inbuilt search or lookup, document ids must be known ahead of time,
or a ledger has to be made. This may change.
