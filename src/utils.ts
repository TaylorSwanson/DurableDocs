
/**
 * Send a get request to a DurableObject, its response is dictated by its type
 * @param doStub Stub for the DO to request data from
 * @param pathname Path starting with "/" to pass to the DO in the request
 * @returns JSON from the request to the DO
 */
export async function getFromDO(
  doStub: DurableObjectStub,
  pathname?: string
): Promise<{ [key: string]: any }> {
  const requestURL = `https://dodb${pathname ? pathname : "/"}`;
  const req = new Request(requestURL);
  const res = await doStub.fetch(req);

  return res.json();
};

/**
 * Empty all DO store content and replace it with new data, does not preserve
 * existing keys
 * @param doStub The DO where a PUT will change all content
 * @param content Object to store in Document
 * @returns Response of the DO request
 */
export async function setDOContent(
  doStub: DurableObjectStub,
  content: { [key: string]: any }
): Promise<Response> {
  const body = JSON.stringify(content);

  const req = new Request("https://dodb/", {
    method: "PUT",
    body
  });

  return await doStub.fetch(req);
};

/**
 * Set up a new DO
 * @param doStub The new DO, must not exist yet
 * @param type Internal type of the DO, dictates its behavior
 * @param payload Optional content to 
 * @returns Response of the DO request
 */
export async function initializeDO(
  doStub: DurableObjectStub,
  type: string,
  payload?: { [key: string]: any }
): Promise<Response> {
  const body = JSON.stringify({
    type,
    payload
  });

  const req = new Request("https://dodb/", {
    method: "POST",
    body
  });

  return await doStub.fetch(req);
};
