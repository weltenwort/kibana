/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import * as rt from 'io-ts';
import { propertyRT } from './property';

export const mappingRT = rt.strict({
  properties: rt.record(rt.string, propertyRT),
});

export type Mapping = rt.TypeOf<typeof mappingRT>;
