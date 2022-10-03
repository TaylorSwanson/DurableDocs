
// Extended iterators are not yet supported and are polyfilled
// See https://www.npmjs.com/package/iterator-helper:
import { aiter, HAsyncIterator } from "iterator-helper";

import Document from "./Document";
import { deleteDO, getFromDO, initializeDO, setDOContent, updateDOContent } from "./utils";

/**
 * A List behaves as a pointer to a collection of documents. Create a List when
 * a single document key refers to multiple other documents.
 */
export default class List {
  // References for the DO
  private id?: string;
  private doNamespace?: DurableObjectNamespace;
  private doStub?: DurableObjectStub;
  /**
   * Lists can belong to only one Document at a time. A List must have a parent
   * Document, they cannot be free-floating.
   */
  private parentDocumentId?: string;

  /**
   * Create a List instance which holds and interfaces with documents.
   * Providing no values to the constructor will create an empty list.
   * @param doNamespace Reference to the DurableDocumentData class
   * @param id Id of existing List
   */
  constructor(
    doNamespace?: DurableObjectNamespace, 
    id?: string
  ) {
    // DurableObject references
    this.id = id;
    this.doNamespace = doNamespace;

    // Get stub if provided
    if (this.id && this.doNamespace) {
      const doId = this.doNamespace?.idFromString(this.id);
      this.doStub = this.doNamespace.get(doId);
    }
  }

  /**
   * Will create a DO and initialize it if this List doesn't have one already
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.doNamespace) {
      throw new Error("Cannot access List which posesses no namespace");
    }

    // Skip if it exists
    if (this.doStub) return;

    const newDoId = this.doNamespace.newUniqueId();
    this.doStub = this.doNamespace.get(newDoId);

    await initializeDO(this.doStub, "list");
  };

  /**
   * Provides access to full data contents of the objects stored in the List.
   * @yields Every Document stored in this List
   */
  public documents(): HAsyncIterator<Document> {
    if (!this.doNamespace) {
      throw new Error("Cannot access List which posesses no namespace");
    }
    if (!this.doStub) {
      // This list is not created yet
      return new HAsyncIterator();
    }

    // We'll generate the iterator in a closure to pass to the polyfill
    const doNamespace = this.doNamespace;
    const doStub = this.doStub;
    const iter = (async function* genAsyncIterable(): AsyncIterable<Document> {
      // Get the latest ids of the objects in this list
      const data = await getFromDO(doStub);
      const ids: string[] = data?.ids ?? [];

      for await (const id of ids) {
        const doId = doNamespace.idFromString(id);
        const document = new Document(doNamespace, doId);

        yield document.init();
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
    if (!this.doStub) {
      // This list is not created yet
      return [];
    }

    // Get the latest ids of the objects in this list
    const data = await getFromDO(this.doStub);
    return data?.ids ?? [];
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
   * Inserts a document at the end of the list, will not insert duplicates.
   * @param doc Document to add to the list.
   * @returns The modified List.
   */
  public async add(doc: Document): Promise<this> {
    if (!this.doNamespace) {
      throw new Error("Cannot access List which posesses no namespace");
    }
    // Ensure list DO exists
    if (!this.doStub) {
      const newDoId = this.doNamespace.newUniqueId();
      this.doStub = this.doNamespace.get(newDoId);
      await initializeDO(this.doStub, "list");
    }

    // TODO

    return this;
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
    await this.documents().forEach(async document => {
      if (!this.parentDocumentId) return;
      await document.parents.unlistId(this.parentDocumentId);
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
    await this.documents().forEach(async document => {
      // Remove parent reference for this List's parent

      // Skip docs that have more than one reference
      // If a doc has one reference, then it must be this List's parent
      const refCount = await (await document.parents.ids()).length;
      if (refCount > 1) {
        if (!this.parentDocumentId) return;
        await document.parents.unlistId(this.parentDocumentId);
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
