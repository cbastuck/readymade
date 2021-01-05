import React, { Component } from 'react';
import { 
  Button,
  Card,
  Image,
  Breadcrumb,
} from 'semantic-ui-react'

import { AppConsumer } from '../../AppContext';
import BoardContext, { BoardConsumer } from '../../BoardContext';
import Toolbar from '../../components/Toolbar';
import Footer from '../../components/Footer';

export default class MyBoards extends Component {
  state = {
    boards: [],
  };

  renderCard = board => {
    return (
      <Card 
        key={`my-board-card-${board.title}`} 
        className="my-board-card"
      >
        <Card.Content>
          <Image
            floated="right"
            size="mini"
            src={board.image}
          />
          <Card.Header>{board.title}</Card.Header>
          <Card.Meta>{board.brief}</Card.Meta>
          <Card.Description>
            {board.description}
          </Card.Description>
        </Card.Content>
        <Card.Content extra>
          <div className="ui two buttons">
            <Button 
              basic 
              color="grey"
              onClick={() => console.log('Loading my board', board)}
            >
              Load
            </Button>
          </div>
        </Card.Content>
      </Card>
    );
  }

  renderMyBoards = () => (
    <Card.Group>
        { this.state.boards.map(b => this.renderCard(b)) }
    </Card.Group>
  );

  renderBreadcrumbs = () => {
    return (
      <div 
        style={{ 
          textAlign: 'left', 
          marginLeft: 5,
        }}
      >
        <Breadcrumb>
          <Breadcrumb.Section 
            link
            onClick={() => console.log('Selected breadcrumb')}
          >
            <span 
              style={{
                letterSpacing: 1,
                textTransform: 'uppercase',
                fontSize: 10,
              }}
            >
              Available Boards
            </span>
          </Breadcrumb.Section>
          <Breadcrumb.Divider />
        </Breadcrumb>
      </div>
    );
  }

  renderMyBoardsContainer = user => {
    return (
      <div className="my-boards-container">
        <div 
          style={{ 
            margin: '10px 10px', 
            textAlign: 'center' ,
            marginBottom: 20
          }}
        >
          <h1  
            style={{ 
              fontSize: 16, 
              margin: '20px 0px',
              padding: 0,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          > 
            {user ? `${user.username}'s` : 'My'} Boards
          </h1>
          { this.renderBreadcrumbs() }
        </div>
        <div className="my-boards-list">
          { this.renderMyBoards() }
        </div>
      </div>
    );
  }


  render() {
    return (
      <AppConsumer>
        {
          appContext => (
            <BoardContext>
              <BoardConsumer>
              {
                boardContext => (
                  <div style={{ height: '100%' }}>
                    <Toolbar 
                      onAction={boardContext.onAction}
                    />
                    { this.renderMyBoardsContainer(appContext.user) }               
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