/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ChartsPluginStart } from '@kbn/charts-plugin/public';
import type { CoreSetup, CoreStart, Plugin as PluginClass } from '@kbn/core/public';
import type { DataPublicPluginStart } from '@kbn/data-plugin/public';
import type { DataViewsPublicPluginStart } from '@kbn/data-views-plugin/public';
import type { DiscoverSharedPublicStart } from '@kbn/discover-shared-plugin/public';
import type { ObservabilityAIAssistantPublicStart } from '@kbn/observability-ai-assistant-plugin/public';
import type { SharePluginSetup, SharePluginStart } from '@kbn/share-plugin/public';
import type { UiActionsStart } from '@kbn/ui-actions-plugin/public';
import { FieldFormatsStart } from '@kbn/field-formats-plugin/public';
import type { LogsSharedLocators } from '../common/locators';
import type { LogAIAssistantProps } from './components/log_ai_assistant/log_ai_assistant';
import type { LogsOverviewProps } from './components/logs_overview';
import type { LogAnalysisServiceStart } from './services/log_analysis';
// import type { OsqueryPluginStart } from '../../osquery/public';
import type { LogViewsServiceSetup, LogViewsServiceStart } from './services/log_views';

// Our own setup and start contract values
export interface LogsSharedClientSetupExports {
  logViews: LogViewsServiceSetup;
  locators: LogsSharedLocators;
}

export interface LogsSharedClientStartExports {
  logViews: LogViewsServiceStart;
  logsAnalysis: LogAnalysisServiceStart;
  LogAIAssistant?: (props: Omit<LogAIAssistantProps, 'observabilityAIAssistant'>) => JSX.Element;
  LogsOverview: React.ComponentType<LogsOverviewProps>;
}

export interface LogsSharedClientSetupDeps {
  share: SharePluginSetup;
}

export interface LogsSharedClientStartDeps {
  charts: ChartsPluginStart;
  data: DataPublicPluginStart;
  dataViews: DataViewsPublicPluginStart;
  discoverShared: DiscoverSharedPublicStart;
  fieldFormats: FieldFormatsStart;
  observabilityAIAssistant?: ObservabilityAIAssistantPublicStart;
  share: SharePluginStart;
  uiActions: UiActionsStart;
}

export type LogsSharedClientCoreSetup = CoreSetup<
  LogsSharedClientStartDeps,
  LogsSharedClientStartExports
>;
export type LogsSharedClientCoreStart = CoreStart;
export type LogsSharedClientPluginClass = PluginClass<
  LogsSharedClientSetupExports,
  LogsSharedClientStartExports,
  LogsSharedClientSetupDeps,
  LogsSharedClientStartDeps
>;

export type UnwrapPromise<T extends Promise<any>> = T extends Promise<infer Value> ? Value : never;

export type LogsSharedClientStartServicesAccessor = LogsSharedClientCoreSetup['getStartServices'];
export type LogsSharedClientStartServices = UnwrapPromise<
  ReturnType<LogsSharedClientStartServicesAccessor>
>;
