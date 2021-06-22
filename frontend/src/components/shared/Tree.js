import React, { Component } from 'react';
import { List } from 'semantic-ui-react'

export class Tree extends Component {
  renderFile = (file, selected, onChange) => {
    const isSelected = file.name === selected;
    const spacing = {
      padding: '1px 2px'
    }
    return (
      <List.Item 
        key={file.name} // TODO - include path
        style={{ cursor: 'pointer' }}
        onClick={ev => onChange(ev, { selected: file.name })} 
      >
        <List.Icon name='file' style={spacing} />
        <List.Content>
          <List.Header 
            style={{ 
              backgroundColor: isSelected && '#4183c4',
              ...spacing
            }}
          >
            <span style={{ color: isSelected && 'white' }}> 
              {file.name} 
            </span>
          </List.Header>
          <List.Description style={spacing}>
            no description available
          </List.Description>
        </List.Content>
      </List.Item>
    );
  }

  renderFolder = (folder, selected, onChange) => (
    <List.Item key={folder.name}>
      <List.Icon name='folder' />
      <List.Content>
        <List.Header>dist</List.Header>
        <List.Description>Compiled CSS and JS files</List.Description>
        <List.List>
          <List.Item>
            <List.Icon name='plus square outline' />
            <List.Content>
              <List.Header>Click to enter</List.Header>
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
      values: files,
      selected,
      onChange,
    } = this.props;
    return (
      <div
        style={{ 
          border: 'solid 1px lightgray',
          borderRadius: 5,
          padding: 5,
          overflow: 'auto',
          maxHeight: 200,
        }}
      >
        { this.renderItems(files, selected, onChange) }
      </div>
    );
  }
}

export default Tree