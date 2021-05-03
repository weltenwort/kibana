/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import * as rt from 'io-ts';

import { datePropertyRT } from './date_property';
import { keywordPropertyRT } from './keyword_property';

export const propertyRT = rt.union([datePropertyRT, keywordPropertyRT]);

export type Property = rt.TypeOf<typeof propertyRT>;
