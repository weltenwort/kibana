/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import * as Either from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/pipeable';
import * as Record from 'fp-ts/lib/Record';
import * as rt from 'io-ts';
import { Mapping } from '../../mapping';
import { propertySchemaRT, generatePropertyMapping } from './property';

export const mappingsSchemaRT = rt.type({
  properties: rt.record(rt.string, propertySchemaRT),
});

export type MappingsSchema = rt.TypeOf<typeof mappingsSchemaRT>;

export const generateMappings = (schema: MappingsSchema): Either.Either<Error, Mapping> =>
  pipe(
    schema.properties,
    Record.traverseWithIndex(Either.either)(generatePropertyMapping),
    Either.map((properties) => ({
      properties,
    }))
  );
