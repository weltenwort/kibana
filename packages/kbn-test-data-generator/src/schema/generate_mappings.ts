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
