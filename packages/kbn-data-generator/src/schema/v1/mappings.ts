/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
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
    Either.map(properties => ({
      properties,
    }))
  );
