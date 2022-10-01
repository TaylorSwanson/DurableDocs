
/**
 * An identifier that passes to and from DurableDocuments methods.
 */
export default class ObjectId {
  public id: string | undefined;

  constructor(id?: string) {
    this.id = id;
  }
}
