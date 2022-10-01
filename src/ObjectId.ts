
/**
 * An identifier that passes to and from DurableDocuments methods.
 */
export default class ObjectId {
  public id: string;

  constructor(id: string, collection: string) {
    this.id = id;
  }
}
