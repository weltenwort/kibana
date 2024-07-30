/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */
import { Faker, faker } from '@faker-js/faker';

type LogMessageGenerator = (f: Faker) => string;

export const unstructuredLogMessageGenerators: LogMessageGenerator[] = [
  (f: Faker) =>
    `${f.internet.ip()} - - [${f.date
      .past()
      .toISOString()
      .replace('T', ' ')
      .replace(
        /\..+/,
        ''
      )}] "${f.internet.httpMethod()} ${f.internet.url()} HTTP/1.1" ${f.helpers.arrayElement([
      200, 301, 404, 500,
    ])} ${f.number.int({ min: 100, max: 5000 })}`,
  (f: Faker) =>
    `${f.database.engine()}: ${f.database.column()} ${f.helpers.arrayElement([
      'created',
      'updated',
      'deleted',
      'inserted',
    ])} successfully ${f.number.int({ max: 100000 })} times`,
  (f: Faker) =>
    `${f.hacker.noun()}: ${f.word.words()} ${f.helpers.arrayElement([
      'triggered',
      'executed',
      'processed',
      'handled',
    ])} successfully at ${f.date.recent().toISOString()}`,
  (f: Faker) => `[${f.date.recent().toISOString()}] ${f.hacker.ingverb()} ${f.hacker.noun()}`,
];

export const generateUnstructuredLogMessage = (
  f: Faker = faker,
  generators: LogMessageGenerator[] = unstructuredLogMessageGenerators
): string => f.helpers.arrayElement(generators)(f);
