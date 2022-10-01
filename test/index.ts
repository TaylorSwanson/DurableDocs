
/**
 * CloudFlare worker that implements the Durable Documents store. This is used
 * locally for development and testing.
 */

import { DurableDocs, DurableDocData } from "../src";



// Re-export the DurableObject class for Wrangler to pick up
export { DurableDocData };
