import _ from 'lodash';
import { bindActionCreators } from 'redux';

import { uiModules } from 'ui/modules';
import contextAppTemplate from './app.html';
import './components/loading_button';
import './components/size_picker/size_picker';
import {
  actions as documentsActions,
} from './documents';
import {
  actions as parametersActions,
  constants as parametersConstants,
} from './parameters';
import * as selectors from './selectors';
import { CreateStoreProvider } from './store';


const module = uiModules.get('apps/context', [
  'elasticsearch',
  'kibana',
  'kibana/config',
  'kibana/notify',
  'ngRoute',
]);

module.directive('contextApp', function ContextApp() {
  return {
    bindToController: true,
    controller: ContextAppController,
    controllerAs: 'contextApp',
    restrict: 'E',
    scope: {
      anchorUid: '=',
      columns: '=',
      indexPattern: '=',
      predecessorCount: '=',
      successorCount: '=',
      sort: '=',
      discoverUrl: '=',
    },
    template: contextAppTemplate,
  };
});

function ContextAppController($scope, $timeout, config, Private, timefilter) {
  const createStore = Private(CreateStoreProvider);

  // this is apparently the "canonical" way to disable the time picker
  timefilter.enabled = false;

  this.store = createStore();

  this.state = this.store.getState();
  const unsubcribeFromStore = this.store.subscribe(() => (
    $timeout(() => this.state = this.store.getState())
  ));
  $scope.$on('$destroy', () => unsubcribeFromStore());

  this.actions = bindActionCreators(Object.assign(
    {},
    parametersActions,
    documentsActions,
  ), this.store.dispatch);

  this.selectors = _.mapValues(selectors, (selector) => (...args) => (
    selector(...args, this.store.getState())
  ));


  this.store.dispatch(parametersActions.setParameters({
    defaultStepSize: parseInt(config.get('context:step'), 10),
  }));

  /**
   * Sync query parameters to arguments
   */
  $scope.$watchCollection(
    () => _.pick(this, parametersConstants.PARAMETER_KEYS),
    (newValues) => {
      // break the watch cycle
      if (!_.isEqual(newValues, this.state.parameters)) {
        this.actions.fetchAllDocumentsWithNewParameters(newValues);
      }
    },
  );

  // $scope.$watchCollection(
  //   () => this.state.parameters,
  //   (newValues) => {
  //     _.assign(this, newValues);
  //   },
  // );
}

// function createInitialState(defaultStepSize, discoverUrl) {
//   return {
//     queryParameters: createInitialQueryParametersState(defaultStepSize),
//     rows: {
//       all: [],
//       anchor: null,
//       predecessors: [],
//       successors: [],
//     },
//     navigation: {
//       discover: {
//         url: discoverUrl,
//       },
//     },
//   };
// }
