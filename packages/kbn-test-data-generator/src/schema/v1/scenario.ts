/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import * as rt from 'io-ts';
import { templateRT } from './template';

export const scenarioRT = rt.type({
  __kbn_data_generator: rt.type({
    schema_version: rt.literal(1),
  }),
  templates: rt.record(rt.string, templateRT),
});

export type Scenario = rt.TypeOf<typeof scenarioRT>;
