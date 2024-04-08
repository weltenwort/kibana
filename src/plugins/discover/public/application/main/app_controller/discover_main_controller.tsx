/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { actions, createMachine, interpret, InterpreterFrom, raise } from 'xstate';

export const createPureDiscoverMainController = () =>
  createMachine({
    /** @xstate-layout N4IgpgJg5mDOIC5QBECWsDGB7AbmATgLICGqAdgMJZkAu+WANgwQHQC2qU+xN5UAyjR5gAxBGpgW5HFgDWkjl2EAFArHQ1Ig4QG0ADAF1EoAA5Z1vasZAAPRAEZ7AThYAmAGwBWd3p-2ALJ5OAMzu7gA0IACeiK7OLE6e3q4AHO7+-o4p-u4AvrmRaJi4BCTkVLT0TKzkqLzEDKgAXnzKxNxsYJr4sCwAZvRsyGB9xACuDDSwIvpGSCBmFqhW83YIwSkA7CzOnpv2wR56qe6ukTEImdspASFOjq6bjyn5hejYeESklNR0jMz4KRkOqoBrNVrtYidbrTcRkSSwISaFhFD6lb4VP7VQG1eqNFpkKBtDpdNSzayLEErUBrewpTw7dJ6TIpQ7uRKs86IJIuYIHQ5pTypVzHV4gVElL7lX5VAEsfBwRg4Pj8LBjfAYURwyTSOSSBWwJVgVXqzXk+aUyxkay0-zBBKbLzBPQ3PR6eyeUJchCbfwuFJpUKefyupJiiWfMo-Sr-VgGo0QE0ayQYAAWWHMrXofVQzBmhgpmatNtiTlcOz0nr0TmrN1cnhS3ruLHpwU2TjLbs8Hqc4fekqjmNlccVDDwibVyZYaYz6kJymzudEOnsc1MReW1tWiGd9hYm2yHaeIb0+3r3scjn32SSwWC9wOiT7xUjGJlscB8bHWknmpEFAACQAQQAOQAcQAUQAfX4AB5ABVAAlCgIPNdclmpWxEDte1Nj0O97GrXx7HcNJNm9dltncTZfVPG8fDvZ80SlaMsTlL9xyTP9ANAyCoOUIDEKAwgIIAFQgxD+DQhYN0wtZ7gZLJ-GZVk6VI-xvU2UIWziZ0gn5NtPHyAoQDILAIDgawI3RaUY2xQsMK3GlEAAWgiaJXPcFg3TdOl9k8at7EeXsTOslihw-dhOG4XhCW0TQHKpJysMuM4PIQFI9BYP0j0cJwwm8A4mIHN87LlXFQXxCESRhRLi23S4Umy3cgpo5x3A2NKLj0lhvD9D1AzvO1itfWy2JqYE8XBedIWhNR+kGYZRgmKY6s3EsEHy5r3Va-Z8s67173tPk-UCVwnEy1wQxGmzWOHHFJsq6aiVm0kegWrA2BA4hlSgHhN3isA1rk7CUnLVInD9NJEhCdx7EOstvPSAMQ0Ix1qxu8L32xeVR2VOLfyBi1ZOStZMrcPy6Xvex2xyCjlJYDYOvymihW7TZMcHbH2Lxn9TSJ9Cko2z1GeDQ9u1cOJoe9ek90IjYDlvGsMk50rxs-XmJ356d00zedF2YYHSYcd1RZDP0Jal9kmzbFgGIPet3QI1Wxvu3HDW-LWpwAdzqVMABksCgWAFywHNDeJxyNv8dtsseR52xp4J-HOm2qPwh2Av5ewXbuyKOL5n2-aW8ZJlD8OBZkqOGpjpqUnyl17ySLTHHI9LHHw7y6QDdqGNcYzciAA */
    initial: 'migratingState',

    states: {
      migratingState: {
        invoke: {
          src: 'migratePersistedState',
          id: 'migratePersistedState',
          onDone: 'initializingParameters',
        },
      },

      initializingParameters: {
        states: {
          fromDefaults: {
            always: 'fromNavigationState',
            entry: 'initializeDefaultParameters',
          },

          fromNavigationState: {
            type: 'final',
            entry: 'updateParametersFromNavigationState',
          },
        },

        initial: 'fromDefaults',

        onDone: 'resolvingSource',
      },

      resolvingSource: {
        invoke: {
          src: 'resolveSource',
          id: 'resolveSource',
          onDone: 'resolvedSource',
        },
      },

      resolvedSource: {
        states: {
          choosingProfile: {
            always: [
              {
                target: 'withLogsProfile',
                cond: 'isLogsSource',
              },
              'withDefaultProfile',
            ],
          },

          withLogsProfile: {
            invoke: [
              {
                src: 'logsProfileController',
                id: 'logsProfileController',
              },
            ],
          },

          withDefaultProfile: {
            invoke: {
              src: 'defaultProfileController',
              id: 'defaultProfileController',
            },
          },
        },

        initial: 'choosingProfile',

        on: {
          CHANGE_SOURCE: 'resolvingSource',

          CHANGE_PARAMETERS: {
            target: 'resolvedSource',
            internal: true,
            actions: ['updateParameters', 'updateNavigationState'],
          },
        },
      },
    },
    id: 'DiscoverMainController',
  });
