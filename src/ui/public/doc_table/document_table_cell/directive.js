import 'ngreact';

import { uiModules } from 'ui/modules';

import { TimeCell } from './time_cell';


const app = uiModules.get('app/kibana', ['react']);

app.directive('documentTableTimeCell', function (reactDirective) {
  return reactDirective(TimeCell, undefined, {
    replace: true,
  });
});
