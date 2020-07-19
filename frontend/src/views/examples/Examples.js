import React, { Component } from 'react';
import { Button, Card, Image } from 'semantic-ui-react'


import { AppConsumer } from '../../AppContext';
import BoardContext, { BoardConsumer } from '../../BoardContext';
import Toolbar from '../../components/Toolbar';
import Footer from '../../components/Footer';

import './Examples.css';

class Example extends Component {
  render() {
    const { title } = this.props;
    return (
      <div className="example">
        <div style={{ marginTop: 40 }}>
          {title}
        </div>
      </div>
    );
  }
}

export default class Examples extends Component {

  renderExamples = () => (
    <Card.Group>
      <Card>
        <Card.Content>
          <Image
            floated='right'
            size='mini'
            src='/images/avatar/large/steve.jpg'
          />
          <Card.Header>Steve Sanders</Card.Header>
          <Card.Meta>Friends of Elliot</Card.Meta>
          <Card.Description>
            Steve wants to add you to the group <strong>best friends</strong>
          </Card.Description>
        </Card.Content>
        <Card.Content extra>
          <div className='ui two buttons'>
            <Button basic color='green'>
              Approve
            </Button>
            <Button basic color='red'>
              Decline
            </Button>
          </div>
        </Card.Content>
      </Card>
      <Card>
        <Card.Content>
          <Image
            floated='right'
            size='mini'
            src='/images/avatar/large/molly.png'
          />
          <Card.Header>Molly Thomas</Card.Header>
          <Card.Meta>New User</Card.Meta>
          <Card.Description>
            Molly wants to add you to the group <strong>musicians</strong>
          </Card.Description>
        </Card.Content>
        <Card.Content extra>
          <div className='ui two buttons'>
            <Button basic color='green'>
              Approve
            </Button>
            <Button basic color='red'>
              Decline
            </Button>
          </div>
        </Card.Content>
      </Card>
      <Card>
        <Card.Content>
          <Image
            floated='right'
            size='mini'
            src='/images/avatar/large/jenny.jpg'
          />
          <Card.Header>Jenny Lawrence</Card.Header>
          <Card.Meta>New User</Card.Meta>
          <Card.Description>
            Jenny requested permission to view your contact details
          </Card.Description>
        </Card.Content>
        <Card.Content extra>
          <div className='ui two buttons'>
            <Button basic color='green'>
              Approve
            </Button>
            <Button basic color='red'>
              Decline
            </Button>
          </div>
        </Card.Content>
      </Card>
    </Card.Group>
  );

  render() {
    return (
      <AppConsumer>
        {
          appContext => (
            <BoardContext
              fetchData={!!appContext.user && !!appContext.user.username}
            >
              <BoardConsumer>
              {
                boardContext => (
                  <div style={{ height: '100%' }}>
                    <Toolbar 
                      savedBoards={boardContext.savedBoards}
                      onAction={boardContext.onAction}
                    />
                    <div className="examples-container">
                      <div style={{ margin: '10px 10px' }}>
                        <h1>Examples</h1>
                        { this.renderExamples() } 
                      </div>
                    </div>
                  </div>
                )
              }
              </BoardConsumer>
              <Footer />
            </BoardContext> 
          )
        }
      </AppConsumer>
    );
  }
}