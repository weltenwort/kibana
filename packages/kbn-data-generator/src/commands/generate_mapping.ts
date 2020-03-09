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

import { Command } from 'commander';
import fs from 'fs';
import util from 'util';
import { Mapping } from '../mapping';
import { Schema, schemaRT } from '../schema';
import { decodeOrThrow } from '../utils/runtime_types';

const readFile = util.promisify(fs.readFile);

export interface GenerateMappingOptions {}

export const registerGenerateMappingCommand = (parentCommand: Command) =>
  parentCommand
    .command('generate-mapping <schema-file>')
    .description('generate the index mapping for the given schema')
    .action(async schemaFile => {
      await generateMappingFromFile(schemaFile);
    });

export const generateMappingFromFile = async (
  schemaFilePath: string,
  options?: GenerateMappingOptions
) => {
  const serializedSchema = await readFile(schemaFilePath, 'utf8');
  return await generateMappingFromString(serializedSchema, options);
};

export const generateMappingFromString = async (
  serializedSchema: string,
  options?: GenerateMappingOptions
): Promise<Mapping> => {
  const decodedSchema = decodeOrThrow(schemaRT)(JSON.parse(serializedSchema));
  return await generateMapping(decodedSchema, options);
};

export const generateMapping = async (
  schema: Schema,
  options?: GenerateMappingOptions
): Promise<Mapping> => {
  return {
    properties: {},
  };
};
