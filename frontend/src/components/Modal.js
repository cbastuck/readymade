import React, { Component } from 'react'
import { Button, Modal } from 'semantic-ui-react'

import { openTab } from '../core/actions';

export default class ModalDialog extends Component {
  render() {
    const { 
      url,
      component,
      setOpen,
      isOpen=false,
      title='',
      style={
        height: '85%',
        width: '90%'
      },
    } = this.props;
    if (!isOpen || (!url && !component)) {
      return false;
    }

    const buttonStyle = {
      textTransform: 'uppercase',
      letterSpacing: 1,
      fontSize: 12,
    };
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
            letterSpacing: 2,
            fontSize: 14,
            textAlign: 'center',
          }}
        >
          {title}
        </Modal.Header>
        <Modal.Content scrolling>
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
            style={buttonStyle}
            onClick={() => {
              openTab(url);
              setOpen(false);
            }}
          >
            Open in Tab
          </Button>
          <Button
            content="Close"
            labelPosition='right'
            icon='checkmark'
            onClick={() => setOpen(false)}
            positive
            style={buttonStyle}
          />
        </Modal.Actions>
      </Modal>
    )
  }
}

