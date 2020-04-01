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
import * as TaskEither from 'fp-ts/lib/TaskEither';
import fs from 'fs';
import util from 'util';
import { Mapping } from '../mapping';
import { parseScenarioString, ScenarioSchema } from './scenario';
import * as v1 from './v1';

type Mappings = Record<string, Mapping>;

const readFile = util.promisify(fs.readFile);

export const generateMappingsFromFile = (
  scenarioFilePath: string
): TaskEither.TaskEither<Error, Mappings> => {
  return pipe(
    TaskEither.tryCatch(() => readFile(scenarioFilePath, 'utf8'), Either.toError),
    TaskEither.chain(TaskEither.fromEitherK(generateMappingsFromString))
  );
};

export const generateMappingsFromString = (
  serializedScenario: string
): Either.Either<Error, Mappings> => {
  return pipe(serializedScenario, parseScenarioString, Either.chain(generateMappings));
};

export const generateMappings = (scenario: ScenarioSchema): Either.Either<Error, Mappings> => {
  if (scenario.__kbn_data_generator.schema_version === 1) {
    return Record.traverse(Either.either)((template: v1.Template) =>
      v1.generateMappings(template.mappings)
    )(scenario.templates);
  } else {
    return Either.left(
      Either.toError(
        `Failed to generate mappings: Unknown schema version "${scenario.__kbn_data_generator.schema_version}".`
      )
    );
  }
};
