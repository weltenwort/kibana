/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import * as rt from 'io-ts';

export const constantStringGeneratorSchema1RT = rt.type({
  type: rt.literal('constantString1'),
  value: rt.string,
});

export type ConstantStringGeneratorSchema1 = rt.TypeOf<typeof constantStringGeneratorSchema1RT>;

export const createConstantStringGenerator1 = (schema: ConstantStringGeneratorSchema1) => () =>
  schema.value;
