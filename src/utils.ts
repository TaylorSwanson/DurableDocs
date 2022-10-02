
// Utils to work with Durable Objects

/**
 * Send a get request from a DurableObject.
 * @param doStub Stub for the DO to request data from.
 * @param pathname Path starting with "/" to pass to the DO in the request.
 * @returns JSON from the request to the DO.
 */
export async function getFromDO(
  doStub: DurableObjectStub,
  pathname?: string
): Promise <any> {
  const requestURL = `https://dodb${pathname ? pathname : "/"}`;
  const contentRequest = new Request(requestURL);
  const contentResponse = await doStub.fetch(contentRequest)

  return contentResponse.json();
};

export async function setDOContent(
  doStub: DurableObjectStub,
  content: { [key: string]: any }
): Promise<any> {
  // TODO
}
