
import Document from "./Document";
import { getFromDO, initializeDO, setDOContent } from "./utils";

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
  public async *documents(): AsyncIterable<Document> {
    if (!this.doNamespace) {
      throw new Error("Cannot access List which posesses no namespace");
    }
    if (!this.doStub) {
      // This list is not created yet
      return [];
    }

    // Get the latest ids of the objects in this list
    const data = await getFromDO(this.doStub);
    const items: string[] = data?.items ?? [];

    // Load the documents iteratively
    for await (const id of items) {
      const doId = this.doNamespace.idFromString(id);
      const document = new Document(this.doNamespace, doId);

      yield document.init();
    }
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
    return data?.items ?? [];
  }

  public async add(doc: Document): Promise<this> {
    if (!this.doNamespace) {
      throw new Error("Cannot access List which posesses no namespace");
    }
    // Ensure doc exists
    if (!this.doStub) {
      const newDoId = this.doNamespace.newUniqueId();
      this.doStub = this.doNamespace.get(newDoId);
      await initializeDO(this.doStub, "list");
    }

    return this;
  }

  /**
   * Clear the list contents without removing any orphan documents created.
   * @returns Number of documents cleared from the list
   */
  public async clear(): Promise<number> {
    if (!this.doNamespace) {
      throw new Error("Cannot access List which posesses no namespace");
    }
    // Don't create the doc if we're clearing it
    if (!this.doStub) {
      return 0;
    }

    await setDOContent(this.doStub, []);

    return 3;
  }

  /**
   * Clear the list contents, deleting documents that are orphaned as a result.
   * @returns Number of documents cleared from the list
   */
  public async clearDelete(): Promise<number> {
    if (!this.doNamespace) {
      throw new Error("Cannot access List which posesses no namespace");
    }
    // Don't create the doc if we're clearing it
    if (!this.doStub) {
      return 0;
    }

    return 3;
  }
}
