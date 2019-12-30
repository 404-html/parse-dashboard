/*
 * Copyright (c) 2016-present, Parse, LLC
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */
import { List, Map }             from 'immutable';
import { dateStringUTC }         from 'lib/DateUtils';
import getFileName               from 'lib/getFileName';
import Parse                     from 'parse';
import Pill                      from 'components/Pill/Pill.react';
import React, { Component }      from 'react';
import styles                    from 'components/BrowserCell/BrowserCell.scss';
import { unselectable }          from 'stylesheets/base.scss';

export default class BrowserCell extends Component {
  constructor() {
    super();

    this.cellRef = React.createRef();
    this.copyableValue = undefined;
  }

  componentDidUpdate() {
    if (this.props.current) {
      const node = this.cellRef.current;
      const { left, right, bottom, top } = node.getBoundingClientRect();

      // Takes into consideration Sidebar width when over 980px wide.
      const leftBoundary = window.innerWidth > 980 ? 300 : 0;

      // BrowserToolbar + DataBrowserHeader height
      const topBoundary = 126;

      if (left < leftBoundary || right > window.innerWidth) {
        node.scrollIntoView({ block: 'nearest', inline: 'start' });
      } else if (top < topBoundary || bottom > window.innerHeight) {
        node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }

      if (!this.props.hidden) {
        this.props.setCopyableValue(this.copyableValue);
      }
    }
  }

  shouldComponentUpdate(nextProps) {
    const shallowVerifyProps = [...new Set(Object.keys(this.props).concat(Object.keys(nextProps)))]
      .filter(propName => propName !== 'value');
    if (shallowVerifyProps.some(propName => this.props[propName] !== nextProps[propName])) {
      return true;
    }
    const { value } = this.props;
    const { value: nextValue } = nextProps;
    if (typeof value !== typeof nextValue) {
      return true;
    }
    const isRefDifferent = value !== nextValue;
    if (isRefDifferent && typeof value === 'object') {
      return JSON.stringify(value) !== JSON.stringify(nextValue);
    }
    return isRefDifferent;
  }

  render() {
    let { type, value, hidden, width, current, onSelect, onEditChange, onFilterChange, setCopyableValue, setRelation, setContextMenu, onPointerClick, row, col } = this.props;
    let content = value;
    this.copyableValue = content;
    let classes = [styles.cell, unselectable];
    if (hidden) {
      content = '(hidden)';
      classes.push(styles.empty);
    } else if (value === undefined) {
      if (type === 'ACL') {
        this.copyableValue = content = 'Public Read + Write';
      } else {
        this.copyableValue = content = '(undefined)';
        classes.push(styles.empty);
      }
    } else if (value === null) {
      this.copyableValue = content = '(null)';
      classes.push(styles.empty);
    } else if (value === '') {
      content = <span>&nbsp;</span>;
      classes.push(styles.empty);
    } else if (type === 'Pointer') {
      if (value && value.__type) {
        const object = new Parse.Object(value.className);
        object.id = value.objectId;
        value = object;
      }
      content = (
        <a href='javascript:;' onClick={onPointerClick.bind(undefined, value)}>
          <Pill value={value.id} />
        </a>
      );
      this.copyableValue = value.id;
    } else if (type === 'Date') {
      if (typeof value === 'object' && value.__type) {
        value = new Date(value.iso);
      } else if (typeof value === 'string') {
        value = new Date(value);
      }
      this.copyableValue = content = dateStringUTC(value);
    } else if (type === 'Boolean') {
      this.copyableValue = content = value ? 'True' : 'False';
    } else if (type === 'Object' || type === 'Bytes' || type === 'Array') {
      this.copyableValue = content = JSON.stringify(value);
    } else if (type === 'File') {
      const fileName = value.url() ? getFileName(value) : 'Uploading\u2026';
      content = <Pill value={fileName} />;
      this.copyableValue = fileName;
    } else if (type === 'ACL') {
      let pieces = [];
      let json = value.toJSON();
      if (Object.prototype.hasOwnProperty.call(json, '*')) {
        if (json['*'].read && json['*'].write) {
          pieces.push('Public Read + Write');
        } else if (json['*'].read) {
          pieces.push('Public Read');
        } else if (json['*'].write) {
          pieces.push('Public Write');
        }
      }
      for (let role in json) {
        if (role !== '*') {
          pieces.push(role);
        }
      }
      if (pieces.length === 0) {
        pieces.push('Master Key Only');
      }
      this.copyableValue = content = pieces.join(', ');
    } else if (type === 'GeoPoint') {
      this.copyableValue = content = `(${value.latitude}, ${value.longitude})`;
    } else if (type === 'Polygon') {
      this.copyableValue = content = value.coordinates.map(coord => `(${coord})`)
    } else if (type === 'Relation') {
      content = (
        <div style={{ textAlign: 'center', cursor: 'pointer' }}>
          <Pill onClick={() => setRelation(value)} value='View relation' />
        </div>
      );
      this.copyableValue = undefined;
    }

    if (current) {
      classes.push(styles.current);
    }
    return (
      <span
        ref={this.cellRef}
        className={classes.join(' ')}
        style={{ width }}
        onClick={() => {
          onSelect({ row, col });
          setCopyableValue(hidden ? undefined : this.copyableValue);
        }}
        onDoubleClick={() => {
          if (type !== 'Relation') {
            onEditChange(true)
          }
        }}
        onTouchEnd={e => {
          if (current && type !== 'Relation') {
            // The touch event may trigger an unwanted change in the column value
            if (['ACL', 'Boolean', 'File'].includes(type)) {
              e.preventDefault();
            }
            onEditChange(true);
          }
        }}
        onContextMenu={e => {
          if (e.type !== 'contextmenu') { return; }
          e.preventDefault();

          onSelect({ row, col });
          setCopyableValue(hidden ? undefined : this.copyableValue);

          const menuItems = [];
          const { field, value, type } = this.props;

          const pickFilter = (constraint, addToExistingFilter) => {
            const filters = addToExistingFilter ? this.props.filters : new List();
            const compareTo = type === 'Pointer' ? value.toPointer() : value;

            onFilterChange(filters.push(new Map({
              field: field,
              constraint,
              compareTo
            })));
          };

          const available = Filters.availableFilters(this.props.simplifiedSchema, this.props.filters);
          const constraints = available && available[field];

          if (constraints) {
            menuItems.push({
              text: 'Set filter...', items: constraints.map(constraint => {
                const definition = Filters.Constraints[constraint];
                const text = `${field} ${definition.name}${definition.comparable ? (' ' + this.copyableValue) : ''}`;
                return {
                  text,
                  callback: pickFilter.bind(this, constraint)
                };
              })
            });

            if (this.props.filters && this.props.filters.size > 0) {
              menuItems.push({
                text: 'Add filter...', items: constraints.map(constraint => {
                  const definition = Filters.Constraints[constraint];
                  const text = `${field} ${definition.name}${definition.comparable ? (' ' + this.copyableValue) : ''}`;
                  return {
                    text,
                    callback: pickFilter.bind(this, constraint)
                  };
                })
              });
            }
          }

          // Push "Get related records from..." context menu item if cell holds a Pointer
          // or objectId and there's a class in relation
          const pointerClassName = (this.props.value && this.props.value.className)
            || (field === 'objectId' && this.props.className);
          if (pointerClassName) {
            const relatedRecordsMenuItem = { text: 'Get related records from...', items: [] };
            this.props.schema.data.get('classes').forEach((cl, className) => {
              cl.forEach((column, field) => {
                if (column.targetClass !== pointerClassName) { return; }
                relatedRecordsMenuItem.items.push({
                  text: className, callback: () => {
                    let relatedObject = value;
                    if (this.props.field === 'objectId') {
                      relatedObject = new Parse.Object(pointerClassName);
                      relatedObject.id = value;
                    }
                    onPointerClick({ className, id: relatedObject.toPointer(), field })
                  }
                })
              });
            });

            relatedRecordsMenuItem.items.length > 0 && menuItems.push(relatedRecordsMenuItem);
          }

          const { pageX, pageY } = e;
          menuItems.length && setContextMenu(pageX, pageY, menuItems);

        }}>
        {content}
      </span>
    );
  }
}
