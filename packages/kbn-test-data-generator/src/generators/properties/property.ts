/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import * as rt from 'io-ts';
import { constantStringGeneratorSchema1RT, createConstantStringGenerator1 } from './constant_v1';

// export const propertyGeneratorSchemaRT = rt.union([constantStringGeneratorSchema1RT]);
export const propertyGeneratorSchemaRT = constantStringGeneratorSchema1RT;

export type PropertyGeneratorSchema = rt.TypeOf<typeof propertyGeneratorSchemaRT>;

export const createPropertyGenerator = (schema: PropertyGeneratorSchema) => {
  if (constantStringGeneratorSchema1RT.is(schema)) {
    return createConstantStringGenerator1(schema);
  }
};
