import expect from 'expect.js';

import {
  reverseSortDirection,
} from 'plugins/kibana/context/api/utils/sorting';


describe('context app', function () {
  describe('function reverseSortDirection', function () {
    it('should reverse a direction given as a string', function () {
      expect(reverseSortDirection('asc')).to.eql('desc');
      expect(reverseSortDirection('desc')).to.eql('asc');
    });
  });
});
