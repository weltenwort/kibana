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
