import _ from 'lodash';
import uiModules from 'ui/modules';
import contextSizePickerTemplate from './size_picker.html';
import './size_picker.less';

const module = uiModules.get('apps/context', [
  'kibana',
]);

module.directive('contextSizePicker', function ContextSizePicker() {
  return {
    replace: true,
    restrict: 'E',
    scope: {
      model: '='
    },
    template: contextSizePickerTemplate,
  };
});
