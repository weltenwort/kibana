/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import * as Either from 'fp-ts/lib/Either';
import * as rt from 'io-ts';
import { keywordPropertyRT, KeywordProperty } from '../../mapping';
import { createPropertyGeneratorRT } from './property_generator';

export const keywordPropertySchemaRT = rt.intersection([
  createPropertyGeneratorRT(rt.void),
  keywordPropertyRT,
]);

export type KeywordPropertySchema = rt.TypeOf<typeof keywordPropertySchemaRT>;

export const generateKeywordPropertyMapping = (
  property: KeywordPropertySchema
): Either.Either<Error, KeywordProperty> => {
  return Either.right(keywordPropertyRT.encode(property));
};
