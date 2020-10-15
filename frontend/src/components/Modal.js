import React, { Component } from 'react'
import { Button, Modal } from 'semantic-ui-react'

export default class ModalDialog extends Component {
  render() {
    const { 
      url,
      component,
      setOpen,
      isOpen=false,
      title='',
      style={
        height: '90%',
        width: '90%'
      },
    } = this.props;
    if (!isOpen || (!url && !component)) {
      return false;
    }
    return (
      <Modal
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
        open={isOpen}
        style={style}
        dimmer="inverted"
      >
        <Modal.Header 
          style={{ 
            textTransform: 'uppercase',
            letterSpacing: 1,
            fontSize: 13
          }}
        >
          {title}
        </Modal.Header>
        <Modal.Content 
          style={{ 
            height: '100%', 
            width: '100%' 
          }}
          scrolling
        >
          { 
            component ? 
              component : 
              <iframe 
                title={title}
                src={url} 
                frameBorder="0"
                style={{
                  height: '100%',
                  width: '100%',
                }}
              />
          }
        </Modal.Content>
        <Modal.Actions>
          <Button 
            onClick={() => setOpen(false)}
          >
            Open in Tab
          </Button>
          <Button
            content="Close"
            labelPosition='right'
            icon='checkmark'
            onClick={() => setOpen(false)}
            positive
          />
        </Modal.Actions>
      </Modal>
    )
  }
}

