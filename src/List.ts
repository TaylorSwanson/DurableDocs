
import Document from "./Document";
import { getFromDO } from "./utils";

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
   * Create a List instance which holds and interfaces with documents.
   * Providing no values to the constructor will create an empty list.
   * @param doNamespace Reference to the DurableDocumentData class
   * @param doId Id of existing List
   */
  constructor(
    doNamespace?: DurableObjectNamespace, 
    doId?: DurableObjectId
  ) {
    this.id = doId?.toString();

    // DurableObject references
    this.doNamespace = doNamespace;
    if (doId && this.doNamespace) {
      this.doStub = this.doNamespace.get(doId);
    }
  }

  /**
   * Provides access to full data contents of the objects stored in the List.
   * @yields Every Document stored in this List
   */
  public async *documents(): AsyncIterable<Promise<any>> {
    if (!this.doNamespace) {
      throw new Error("Cannot access List which posesses no namespace");
    }
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
      const document = new Document(this.doNamespace, doId);

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
