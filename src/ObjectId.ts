
/**
 * An identifier that passes to and from DurableDocuments methods.
 */
export class ObjectId {
  public id: string | undefined;

  constructor(id?: string) {
    this.id = id;
  }
}
