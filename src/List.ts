
// Extended iterators are not yet supported and are polyfilled
// See https://www.npmjs.com/package/iterator-helper:
import { aiter, HAsyncIterator } from "iterator-helper";
import { Document } from ".";

import { deleteDO, getFromDO, initializeDO, setDOContent, updateDOContent } from "./utils";

/**
 * A List behaves as a pointer to a collection of documents. Create a List when
 * a single document key refers to multiple other documents.
 */
export class List {
  // References for the DO
  private id: string;
  private doNamespace: DurableObjectNamespace;
  private doStub: DurableObjectStub;
  /**
   * Lists can belong to only one Document at a time. A List must have a parent
   * Document, they cannot be free-floating.
   */
  // private parentRef?: Document | List;

  private initialized = false;

  /**
   * Create a List instance which holds and interfaces with documents.
   * Providing no values to the constructor will create an empty list.
   * @param doNamespace Reference to the DurableDocumentData class
   * @param id Id of existing List
   * @param ref Ref of this List in the parent Object or List (circular ref)
   */
  constructor(
    doNamespace: DurableObjectNamespace, 
    id?: string,
    // ref?: Document | List
  ) {
    // DurableObject references
    this.doNamespace = doNamespace;

    if (id && this.doNamespace) {
      // Get existing stub
      this.id = id;
      const doId = this.doNamespace?.idFromString(this.id);
      this.doStub = this.doNamespace.get(doId);

      this.initialized = true;
    } else {
      // Initialize
      const newDoId = this.doNamespace.newUniqueId();
      this.id = newDoId.toString();
      this.doStub = this.doNamespace.get(newDoId);
    }
  }

  public async init(): Promise<List> {
    if (!this.initialized) {
      await initializeDO(this.doStub, "list");
    }

    return this;
  }

  /**
   * Set the circular reference to this List in the parent
   * @param ref This List in the parent Document or List
   */
  // public setParentRef(
  //   ref: Document | List
  // ) {
  //   this.parentRef = ref;
  // };

  /**
   * Provides access to full data contents of the objects stored in the List.
   * @yields Every Document stored in this List
   */
  public async documents(): Promise<HAsyncIterator<Document>> {
    if (!this.doNamespace) {
      throw new Error("Cannot access List which posesses no namespace");
    }
    if (!this.initialized) {
      await initializeDO(this.doStub, "list");
    }

    // We'll generate the iterator in a closure to pass to the polyfill
    const doNamespace = this.doNamespace;
    const doStub = this.doStub;
    const iter = (async function* genAsyncIterable(): AsyncIterable<Document> {
      // Get the latest ids of the objects in this list
      const data = await getFromDO(doStub);
      const ids: string[] = data?.ids ?? [];

      for await (const id of ids) {
        const document = new Document(doNamespace, id);
        yield document.load();
      }
    })();

    // Extend the iterator to HAsyncIterator
    return aiter(iter);
  }

  /**
   * @returns Ids of the objects in this list
   */
  public async ids(): Promise<string[]> {
    if (!this.doNamespace) {
      throw new Error("Cannot access List which posesses no namespace");
    }

    // Get the latest ids of the objects in this list
    const data = await getFromDO(this.doStub) ?? [];
    return data?.ids ?? [];
  }

  public async size(): Promise<number> {
    return (await this.ids()).length;
  }

  /**
   * Remove an id from the list, does not delete any Documents.
   * @param id Id to remove from the list.
   */
  public async unlistId(id: string): Promise<void> {
    if (!this.doNamespace) {
      throw new Error("Cannot access List which posesses no namespace");
    }
    // Don't create the doc if the list is empty anyway
    if (!this.doStub) {
      return;
    }

    // Replace contents of ids in the list with DO including the new list
    const remainingIds = (await this.ids()).filter(id => id !== id);
    await updateDOContent(this.doStub, {
      ids: remainingIds
    });
  }

  /**
   * Inserts a documet id at the end of the list, will not insert duplicates.
   * @param doc Document to add to the list.
   * @returns The modified List.
   */
  public async addId(newId: string): Promise<void> {
    if (!newId) {
      throw new Error("Can't add empty id to List");
    }
    if (!this.doNamespace) {
      throw new Error("Cannot access List which posesses no namespace");
    }

    const ids = await this.ids();
    if (ids.includes(newId)) {
      // Don't insert duplicates
      return;
    }

    ids.push(newId);
    await updateDOContent(this.doStub, {
      ids
    });
  }

  /**
   * Inserts a document at the end of the list, will not insert duplicates, and
   * will preserves references to parents.
   * @param doc Document to add to the list.
   * @returns The modified List.
   */
  public async addDoc(doc: Document): Promise<void> {
    await this.addId(doc.id);

    // Reference this list owner as parent reference for the doc
    await (await doc.parents() as List).addId(this.id);
  }

  /**
   * Clear the list contents without removing any orphan documents created.
   * @returns Number of documents cleared from the list.
   */
  public async clear(): Promise<void> {
    if (!this.doNamespace) {
      throw new Error("Cannot access List which posesses no namespace");
    }
    // Don't create the doc if we're clearing it
    if (!this.doStub) {
      return;
    }

    // Process documents in list, remove parent refs - keeping any orphans
    await (await this.documents()).forEach(async document => {
      await (await document.parents()).unlistId(this.id);
    });

    await setDOContent(this.doStub, []);
  }

  /**
   * Clear the list contents, deleting documents that are orphaned as a result.
   * Each document in the list will have its own lists deleted too, with those
   * references being cleaned up and so on.
   * @returns Number of documents cleared from the list
   */
  public async clearDelete(): Promise<void> {
    if (!this.doNamespace) {
      throw new Error("Cannot access List which posesses no namespace");
    }
    // Don't create the doc if we're clearing it
    if (!this.doStub) {
      return;
    }
    
    // Process documents in list, remove parent refs and delete orphans 
    await (await this.documents()).forEach(async document => {
      // Remove parent reference for this List's parent

      // Skip docs that have more than one reference
      // If a doc has one reference, then it must be this List's parent
      const parentList = await document.parents();
      const refCount = await parentList.size();
      if (refCount > 1) {
        await parentList.unlistId(this.id);
      } else {
        // Don't bother updating the parent refs before deletion
        await document.delete();
      }
    });
  }

  /**
   * Delete the DO holding this List
   */
  public async delete(): Promise<void> {
    if (!this.doNamespace) {
      throw new Error("Cannot access List which posesses no namespace");
    }
    if (!this.doStub) {
      return;
    }

    await deleteDO(this.doStub);
  }
}
