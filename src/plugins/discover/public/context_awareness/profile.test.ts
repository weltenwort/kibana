/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { BehaviorSubject, combineLatest, map } from 'rxjs';
import { ComposableProfile } from './composable_profile';
import {
  DataSourceCategory,
  DataSourceContextProviderParams,
  RootContextProviderParams,
  SolutionType,
} from './context';
import { resolveDataSourceContext, resolveRootContext } from './pure_context';

test('can react to context changes', async () => {
  const rootContextParams$ = new BehaviorSubject<RootContextProviderParams>({
    solutionNavId: 'search',
  });

  const rootContext$ = rootContextParams$.pipe(map(resolveRootContext));

  const dataSourceContextParams$ = new BehaviorSubject<DataSourceContextProviderParams>({
    dataSource: DataSourceCategory.Logs,
  });

  const dataSourceContext$ = dataSourceContextParams$.pipe(map(resolveDataSourceContext));

  const rootProfile$ = rootContext$.pipe(
    map((context) => {
      if (context.solutionType === SolutionType.Search) {
        return searchProfile;
      }
    })
  );

  const dataSourceProfile$ = dataSourceContext$.pipe(
    map((context) => {
      if (context.category === DataSourceCategory.Logs) {
        return logsSourceProfile;
      }
    })
  );

  const profiles$ = combineLatest([rootProfile$, dataSourceProfile$]);
});

const searchProfile: ComposableProfile = {
  getTopNavItems: () => () => [{ __brand: 'TopNavItem', name: 'SearchTopNavItem1' }],
};

const logsSourceProfile: ComposableProfile = {};
