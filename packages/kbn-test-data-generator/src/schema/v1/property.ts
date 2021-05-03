/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import * as Either from 'fp-ts/lib/Either';
import * as rt from 'io-ts';
import { Property } from '../../mapping';
import { datePropertySchemaRT, generateDatePropertyMapping } from './date_property';
import { keywordPropertySchemaRT, generateKeywordPropertyMapping } from './keyword_property';

export const propertySchemaRT = rt.union([datePropertySchemaRT, keywordPropertySchemaRT]);

export type PropertySchema = rt.TypeOf<typeof propertySchemaRT>;

export const generatePropertyMapping = (
  propertyName: string,
  property: PropertySchema
): Either.Either<Error, Property> => {
  if (datePropertySchemaRT.is(property)) {
    return generateDatePropertyMapping(property);
  } else if (keywordPropertySchemaRT.is(property)) {
    return generateKeywordPropertyMapping(property);
  } else {
    return Either.left(
      new Error(
        `Failed to generate mapping for property "${propertyName}": unsupported property type.`
      )
    );
  }
};
