
// Simple container class to denote the type of value

import Document from "./Document";
import { getFromDO } from "./utils";

type ListItemArray = [{
  id: string,
  createdAt: Date,
  metadata?: string
}];

export default class List {
  // References for the DO
  private id: string | undefined;
  private doNamespace: DurableObjectNamespace;
  private doStub: DurableObjectStub | undefined;

  /**
   * Create a List instance which holds and interfaces with documents.
   * Providing no values to the constructor will create an empty list.
   * @param doNamespace Reference to the DurableDocumentData class.
   * @param id Id of DurableObject that holds contents for this List.
   */
  constructor(
    doNamespace: DurableObjectNamespace, 
    id?: string
  ) {
    this.doNamespace = doNamespace;
    this.id = id;

    if (id) {
      const doId = doNamespace.idFromString(id);
      this.doStub = this.doNamespace.get(doId);
    }
  }

  /**
   * Provides access to full data contents of the objects stored in the List.
   * @yields Every Document stored in this List.
   */
  public async *documents(): AsyncIterable<Promise<any>> {
    if (!this.doStub) {
      // This list is not created yet
      return [];
    }

    // Get the latest ids of the objects in this list
    const data = await getFromDO(this.doStub);
    const items: string[] = data.items;

    // Load the documents iteratively
    for await (const item of items) {
      const doId = this.doNamespace.idFromString(item);
      const document = new Document(doId, this.doNamespace);

      yield document.init();
    }
  }

  /**
   * Clear the list contents without removing any orphan documents created.
   * @returns Number of documents cleared from the list
   */
  public async clear(): Promise<number> {
    // TODO
    return 2;
  }

  /**
   * Clear the list contents, deleting documents that are orphaned as a result.
   * @returns Number of documents cleared from the list
   */
  public async clearDelete(): Promise<number> {
    // TODO
    return 3;
  }
}
