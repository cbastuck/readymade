import React, { Component } from 'react';
import { List } from 'semantic-ui-react'

export class Tree extends Component {
  renderFile = (file, selected, onChange) => {
    const isSelected = file.name === selected;
    return (
      <List.Item 
        key={file.name} // TODO - include path
        style={{ cursor: 'pointer' }}
        onClick={ev => onChange(ev, { selected: file.name })} 
      >
        <List.Icon name='file' />
        <List.Content>
          <List.Header style={{ backgroundColor: isSelected && '#4183c4' }}>
            <span style={{ color: isSelected && 'white' }}> 
              {file.name} 
            </span>
          </List.Header>
          <List.Description>no description available</List.Description>
        </List.Content>
      </List.Item>
    );
  }

  renderFolder = (item, selected, onChange) => (
    <List.Item>
      <List.Icon name='folder' />
      <List.Content>
        <List.Header>dist</List.Header>
        <List.Description>Compiled CSS and JS files</List.Description>
        <List.List>
          <List.Item>
            <List.Icon name='folder' />
            <List.Content>
              <List.Header>components</List.Header>
              <List.Description>
                Individual component CSS and JS
              </List.Description>
            </List.Content>
          </List.Item>
        </List.List>
      </List.Content>
    </List.Item>
  )

  renderItems = (items, selected, onChange) => (
    <List>
      {
        items.map(item => item.type === 'file' ? 
          this.renderFile(item, selected, onChange) : 
          this.renderFolder(item, selected, onChange)
        )
      }     
    </List>
  )

  render() {
    const {
      values,
      selected,
      onChange,
    } = this.props;
    const files = Object.keys(values).map(x => ({ name: x, type: 'file' }));
    return (
      <div
        style={{ 
          border: 'solid 1px lightgray',
          borderRadius: 5,
          padding: 5,
          overflow: 'auto'
        }}
      >
        { this.renderItems(files, selected, onChange) }
      </div>
    );
  }
}

export default Tree