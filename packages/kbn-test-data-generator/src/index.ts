/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import commander from 'commander';

import { registerGenerateMappingsCommand } from './commands';

export const run = async (argv: string[] = process.argv): Promise<void> => {
  if (argv.length < 3) {
    mainCommand.outputHelp();
  } else {
    return await mainCommand.parseAsync(argv);
  }
};

const mainCommand = new commander.Command();

mainCommand
  .description('Generate mappings and documents from a schema for use with Elasticsearch.')
  .version('0.1.0');

registerGenerateMappingsCommand(mainCommand);
