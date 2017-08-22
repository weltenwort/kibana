import _ from 'lodash';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

import { DocumentTableCell } from '..';


export function DocumentTableDataCell({
  className,
  column,
  row,
}) {
  const formatValue = column.format || _.identity;
  const getValue = column.getValue || _.property(column.property);
  const { extraClasses, ...rest } = column.getProps ? column.getProps(row) : {};
  const classes = classNames(extraClasses, className);

  return (
    <DocumentTableCell
      className={classes}
      {...rest}
    >
      {formatValue(getValue(row), row)}
    </DocumentTableCell>
  );
}

DocumentTableDataCell.propTypes = {
  className: PropTypes.string,
  column: PropTypes.object,
  row: PropTypes.object,
};
