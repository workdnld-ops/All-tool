import {createPriceConfigHandler} from '../../server/price-difference-config.mjs';

export function onRequest(context) {
 return createPriceConfigHandler()(context.request);
}
