
# ObjectStore

Provides an interface to a Durable-Objects-based storage mechanism; similar to
a document database.


## Features

- Document-style database
- Lives entirely in Durable Objects
- Built-in references to other objects
- Garbage Collection for orphaned objects


## Types

Types and the functions that create them are closely related

`new ObjectStore(env.STORE).list` A list of objects of any type. Function, accepts an array on
creation.

`new ObjectStore(env.STORE).objectId` A reference to another object in the objectStore of any
type. Function, accepts an objectId instance or an id.

### JS Classes

These are not the structures used in the database.


#### Pointer class

Used to interface with an object, e.g., to load data or to get properties of the
object itself without a full load.

Signature:

```typescript

// Recursive, always leads to a non-primitive
// Does not reference data, references refs types of data only
// You cannot access data this way
type PropChainItem = { List | ObjectId | { [key: string]: PropChainItem } }

interface {
  id: string,
  collection: string,
  // Props stored in the object, not loaded initially*
  // *unless the object is directly loaded from a collection().get() call
  // If it's already loaded, get just returns immediately
  async get(): {[[key: string]: any]},
  parents: List,
  // Props stored but not data (this is pulled from metadata)
  [key: string]: PropChainItem
}
```


## Methods demonstration

```typescript
// Get a user by their id
const user = await new ObjectStore(env.STORE).collection("users").getFromId("12345");
if (!user) {
  console.error("User 12345 does not exist");
}

const userId = user.id;
// > 12345

// Create a room
const room = await new ObjectStore(env.STORE).collection("rooms").new({
  name: "Test Room",
  accessName: "",
  accessCode: "",
  owner: new ObjectStore(env.STORE).objectId("12345"),
  things: new ObjectStore(env.STORE).list(),
  users: {
    admins: new ObjectStore(env.STORE).list(),
    members: new ObjectStore(env.STORE).list()
  }
});
// > rooms document object

// Access list
await (await room.get()).users.members;
// > []

// Access literal
(await room.get()).name;
// > "Test Room"

// Access object
(await room.get()).users;
// > { admins: List, members: List }


// Update by id
await new ObjectStore(env.STORE).collection("rooms").update(room.id, {
  accessName: "NewAccessName1"
});
// > rooms document object
(await room.get()).accessName;
// > "NewAccessName1"

// Update from document
await room.set({
  accessName: "NewAccessName2"
});
// > rooms document object
(await room.get()).accessName;
// > "NewAccessName2"
// Notice that the original room document returns the updated value

// Create a user with no props
const user2 = await new ObjectStore(env.STORE).collection("users").new();
// > users document object
// > user2.id = 54321

// Add from an object
room.refs.users.members
// > List
await room.refs.users.members.add(user2);
// > boolean success
// Room will now have a user2 in the users.members list
// The user2 object will be able to access objects that reference it

// Or from a collection
await room.refs.users.members.add("users", user2.id);
await room.refs.users.members.get();
// > [ { document object } ]

// Same access pattern:
(await room.get()).users.members;
// > List
room.refs.users.members;
// > List

// Add another user
const user3 = await new ObjectStore(env.STORE).collection("users").new();
await room.refs.users.members.add(user3);

(await room.refs.users.members.get()).length;
// > 2 (items in list)

user3.parents;
// > List

await user3.parents.get();
// > [ { rooms document } ]

await room.refs.users.fakeKey.nothing.noexist;
// ReferenceError

// Delete user without deleting parent list reference first
await user3.delete();
// > true (status)

// User was removed from the members list automatically
(await room.refs.users.members.get()).length;
// > 1 (items in list)

await room.refs.users.members.clear();
// > 1 (number removed)
```


### Internal stored object structure

The DurableObject's contents are not very complicated.

```typescript
{
  // Stored content in the objects
  data: supplied data,

  // Describes the types of data at each key
  meta: {
    lists: [
      "users.admins",
      "users.members"
    ],
    ids: [
      "owner"
    ]
  },

  // Parent references to this object
  parents: [
    { doId, keyPath },
    { doId, keyPath }
  ]
}
```

### List object structure

```typescript
{
  ids: ["12345", "54321", "12132"]
}
```
