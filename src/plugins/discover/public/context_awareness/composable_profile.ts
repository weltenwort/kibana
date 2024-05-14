/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

export type ComposableAccessor<T> = (getPrevious: T) => T;

export type AccessorFor<T> = T extends ComposableAccessor<infer U> ? U : never;

export interface Profile {
  getTopNavItems: (count: number) => TopNavItem[];
  getDefaultColumns: () => Column[];
  getFlyout: () => FlyoutComponent;
}

export type ComposableProfile = {
  [K in keyof Profile]?: ComposableAccessor<Profile[K]>;
};

export const getMergedAccessor =
  <T extends keyof ComposableProfile>(key: T, baseProfile: Profile) =>
  (profiles: ComposableProfile[]): Profile[T] =>
    profiles.reduce((nextAccessor: Profile[T], profile) => {
      const currentAccessor = profile[key];
      return currentAccessor ? currentAccessor(nextAccessor) : nextAccessor;
    }, baseProfile[key]);

// placeholders

interface TopNavItem {
  __brand: 'TopNavItem';
  name: string;
}

interface Column {
  __brand: 'Columns';
  name: string;
}

interface FlyoutComponent {
  __brand: 'FlyoutComponent';
  name: string;
}
