/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { ComposableProfile, getMergedAccessor, Profile } from './profile';

test('getMergedAccessor works with an empty list of profiles', () => {
  const baseProfile: Profile = {
    getTopNavItems: () => [{ __brand: 'TopNavItem', name: 'BaseTopNavItem1' }],
    getDefaultColumns: () => [{ __brand: 'Columns', name: 'BaseColumn1' }],
    getFlyout: () => ({ __brand: 'FlyoutComponent', name: 'BaseFlyoutComponent' }),
  };

  const getTopNavItems = getMergedAccessor('getTopNavItems', baseProfile)([]);
  const getDefaultColumns = getMergedAccessor('getDefaultColumns', baseProfile)([]);
  const getFlyout = getMergedAccessor('getFlyout', baseProfile)([]);

  expect(getTopNavItems()).toEqual([{ __brand: 'TopNavItem', name: 'BaseTopNavItem1' }]);
  expect(getDefaultColumns()).toEqual([{ __brand: 'Columns', name: 'BaseColumn1' }]);
  expect(getFlyout()).toEqual({ __brand: 'FlyoutComponent', name: 'BaseFlyoutComponent' });
});

test('getMergedAccessor works with a list of profiles', () => {
  const baseProfile: Profile = {
    getTopNavItems: () => [{ __brand: 'TopNavItem', name: 'BaseTopNavItem1' }],
    getDefaultColumns: () => [{ __brand: 'Columns', name: 'BaseColumn1' }],
    getFlyout: () => ({ __brand: 'FlyoutComponent', name: 'BaseFlyoutComponent' }),
  };

  const profile1: ComposableProfile = {
    getTopNavItems: () => () => [{ __brand: 'TopNavItem', name: 'Profile1TopNavItem1' }],
  };

  const profile2: ComposableProfile = {
    getTopNavItems: (previousGetTopNavItems) => () =>
      [...previousGetTopNavItems(), { __brand: 'TopNavItem', name: 'Profile2TopNavItem1' }],
    getDefaultColumns: (previousGetDefaultColumns) => () =>
      [...previousGetDefaultColumns(), { __brand: 'Columns', name: 'Profile2Column1' }],
  };

  const profiles = [profile1, profile2];

  const getTopNavItems = getMergedAccessor('getTopNavItems', baseProfile)(profiles);
  const getDefaultColumns = getMergedAccessor('getDefaultColumns', baseProfile)(profiles);
  const getFlyout = getMergedAccessor('getFlyout', baseProfile)(profiles);

  expect(getTopNavItems()).toEqual([
    { __brand: 'TopNavItem', name: 'Profile1TopNavItem1' },
    { __brand: 'TopNavItem', name: 'Profile2TopNavItem1' },
  ]);
  expect(getDefaultColumns()).toEqual([
    { __brand: 'Columns', name: 'BaseColumn1' },
    { __brand: 'Columns', name: 'Profile2Column1' },
  ]);
  expect(getFlyout()).toEqual({
    __brand: 'FlyoutComponent',
    name: 'BaseFlyoutComponent',
  });
});
