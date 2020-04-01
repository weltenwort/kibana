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
import * as rt from 'io-ts';
import { chainDecode } from '../utils/runtime_types';
import * as v1 from './v1';

// this will become a union once additional schema versions are added
export const scenarioRT = v1.scenarioRT;

export type ScenarioSchema = rt.TypeOf<typeof scenarioRT>;

export const parseScenarioString = (
  serializedScenario: string
): Either.Either<Error, ScenarioSchema> =>
  pipe(Either.parseJSON(serializedScenario, Either.toError), chainDecode(scenarioRT));
