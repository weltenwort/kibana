/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { dynamic } from '@kbn/shared-ux-utility';
import React from 'react';
import type { LogsOverviewDeps, LogsOverviewProps } from './logs_overview';

export type { LogsOverviewProps } from './logs_overview';

export const LogsOverviewLazy = dynamic(() => import('./logs_overview'));

export const createLogsOverview = (deps: LogsOverviewDeps) => (props: LogsOverviewProps) =>
  <LogsOverviewLazy dependencies={deps} {...props} />;
