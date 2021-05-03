/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import * as Either from 'fp-ts/lib/Either';
import * as rt from 'io-ts';
import { datePropertyRT, DateProperty } from '../../mapping';
import { createPropertyGeneratorRT } from './property_generator';

export const datePropertySchemaRT = rt.intersection([
  createPropertyGeneratorRT(rt.UnknownRecord),
  datePropertyRT,
]);

export type DatePropertySchema = rt.TypeOf<typeof datePropertySchemaRT>;

export const generateDatePropertyMapping = (
  property: DatePropertySchema
): Either.Either<Error, DateProperty> => {
  return Either.right(datePropertyRT.encode(property));
};
