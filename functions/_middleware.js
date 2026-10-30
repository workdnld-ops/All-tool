import {protectToolbox} from '../server/toolbox-auth.mjs';

export const onRequest = context => protectToolbox(context);
