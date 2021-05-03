/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import * as Either from 'fp-ts/lib/Either';
import { identity } from 'fp-ts/lib/function';
import { pipe } from 'fp-ts/lib/pipeable';
import { Errors, Type } from 'io-ts';
import { failure } from 'io-ts/lib/PathReporter';

type ErrorFactory = (message: string) => Error;

export const createPlainError = (message: string) => new Error(message);

export const throwErrors = (createError: ErrorFactory) => (errors: Errors) => {
  throw createError(failure(errors).join('\n'));
};

export const chainDecode = <A, O, I>(runtimeType: Type<A, O, I>, toError = Either.toError) =>
  Either.chain((encodedValue: I) =>
    pipe(
      runtimeType.decode(encodedValue),
      Either.mapLeft((errors) => toError(failure(errors).join('\n')))
    )
  );

export const decodeOrThrow = <A, O, I>(
  runtimeType: Type<A, O, I>,
  createError: ErrorFactory = createPlainError
) => (inputValue: I) =>
  pipe(runtimeType.decode(inputValue), Either.fold(throwErrors(createError), identity));
