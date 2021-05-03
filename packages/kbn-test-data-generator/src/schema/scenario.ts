/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
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
