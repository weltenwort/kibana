import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';

import './document_table_cell.css';


export function DocumentTableCell({
  children,
  className,
  ...rest,
}) {
  const classes = classNames('documentTable__cell', className);

  return (
    <td className={classes} {...rest}>
      {children}
    </td>
  );
}

DocumentTableCell.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
};
