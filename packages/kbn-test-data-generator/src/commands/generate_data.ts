/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { Command } from 'commander';

export const registerGenerateDataCommand = (parentCommand: Command) =>
  parentCommand
    .command('generate-data <scenario-file>')
    .description('generate the data for the given scenario')
    .action(async (scenarioFile) => {
      // const mappings = await generateMappingsFromFile(scenarioFile)();
      // Either.fold(printErrorLine, value => {
      //   return printLine(JSON.stringify(value, null, 2));
      // })(mappings);
    });
