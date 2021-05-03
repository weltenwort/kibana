/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

export const printLine = (message: string) => {
  // eslint-disable-next-line no-console
  console.log(message);
};

export const printErrorLine = (error: Error) => {
  // eslint-disable-next-line no-console
  console.error(`${error.name}: ${error.message}`);
};
