/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import * as Either from 'fp-ts/lib/Either';
import { generateMappings } from './generate_mappings';

describe('generateMapping function', () => {
  test('handles an empty scenario', () => {
    const mapping = generateMappings({
      __kbn_data_generator: { schema_version: 1 },
      templates: {},
    });

    expect(mapping).toStrictEqual(Either.right({}));
  });

  test('handles a simple mapping with common parameters', () => {
    const mapping = generateMappings({
      __kbn_data_generator: { schema_version: 1 },
      templates: {
        firstTemplate: {
          mappings: {
            properties: {
              '@timestamp': {
                __kbn_data_generator: {},
                type: 'date',
                index: true,
              },
            },
          },
        },
      },
    });

    expect(mapping).toStrictEqual(
      Either.right({
        firstTemplate: {
          properties: {
            '@timestamp': {
              type: 'date',
              index: true,
            },
          },
        },
      })
    );
  });
});
