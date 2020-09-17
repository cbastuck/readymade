import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { 
  Card,
  Image,
  Breadcrumb,
} from 'semantic-ui-react'

import { AppConsumer } from '../../AppContext';
import BoardContext, { BoardConsumer } from '../../BoardContext';
import Toolbar from '../../components/Toolbar';
import Footer from '../../components/Footer';

const examples = [
  {
    title: 'Hello World',
    brief: 'The mother of examples',
    description: 'This example is showing the basic structure of a hookup chain',
    image: '/assets/shutterstock_1196210650.png',
    url: '/boards/examples/helloworld.json'
  },
  {
    title: 'Bots vs. Humans',
    brief: 'Who works harder',
    description: 'Listen to changes on Wikipedia',
    image: '/assets/shutterstock_1196210650.png',
    url: '/boards/examples/botsvshumans.json'
  },
  {
    title: 'Filestorage',
    brief: '',
    description: 'Access files from dropbpx',
    image: '/assets/shutterstock_1196210650.png',
    url: '/boards/examples/filestorage.json'
  }
];

export default class Examples extends Component {
  state = {};

  renderCard = example => {
    const fontStyle = {
      letterSpacing: 1,
      textTransform: 'uppercase',
      fontSize: 12,
      textAlign: 'center',
    };
    return (
      <Card 
        key={`example-card-${example.title}`}
        style={fontStyle}
      >
        <Card.Content>
          <Image
            floated="right"
            size="mini"
            src={example.image}
            style={{ marginTop: 3 }}
          />
          <Card.Header
            style={{ marginTop: 3 }}
          >
            {example.title}
          </Card.Header>
          <Card.Meta style={{ margin: '5px 0px' }}>
            {example.brief}
          </Card.Meta>
          <Card.Description style={{ marginTop: 10 }}>
            <div style={{ textAlign: 'left' }}>
              {example.description}
            </div>
          </Card.Description>
        </Card.Content>
        <Card.Content extra>
          <div style={{ margin: '5px 0px' }}>
            <Link
              style={{
                ...fontStyle, 
                color: '#4284C4',
              }}
              to={`/examples?url=${example.url}`}
            >
              Show Board
            </Link>
          </div>
        </Card.Content>
      </Card>
    );
  }

  renderExamples = () => (
    <Card.Group>
        { examples.map(ex => this.renderCard(ex)) }
    </Card.Group>
  );

  renderBreadcrumbs = () => {
    const breadcrumpStyle = {
      letterSpacing: 1,
      textTransform: 'uppercase',
      fontSize: 11,
      margin: '0px 2px',
    };
    const currentExample = this.getCurrentExample();
    return (
      <div 
        style={{ 
          textAlign: 'left', 
          marginLeft: 5,
        }}
      >
        <Breadcrumb>
          <Breadcrumb.Section>
            <Link 
              style={breadcrumpStyle} 
              to="/examples"
            >
              Examples
            </Link>
          </Breadcrumb.Section>
          <Breadcrumb.Divider />
          { 
            currentExample && 
              <Breadcrumb.Section link>
                  <span style={breadcrumpStyle}>
                    { currentExample.title }
                  </span>
              </Breadcrumb.Section>
          }
        </Breadcrumb>
      </div>
    );
  }

  renderExamplesContainer = () => {
    const currentExample = this.getCurrentExample();
    return (
      <div 
        style={{ 
          marginTop: 20, 
          height: '100%',
        }}
      >
        <div 
          style={{ 
            margin: '10px 10px', 
            textAlign: 'center' ,
            marginBottom: 20,
          }}
        >
          <h1 style={{ margin: 0, padding: 0 }}>
            <div 
              style={{
                letterSpacing: 8,
                textTransform: 'uppercase',
                fontSize: 18,
                marginTop: 15
              }}
            > 
              Examples
            </div>
          </h1>
          { currentExample && this.renderBreadcrumbs() }
        </div>
        <div 
          style={{ 
            margin: 40, 
            height: '100%' 
          }}
        >
        {
          currentExample ? 
            this.renderSandbox() : 
            this.renderExamples()
        }
        </div>
      </div>
    );
  }

  renderSandbox = () => {
    const currentExample = this.getCurrentExample();
    return currentExample && (
      <div style={{ width: '100%', height: '100%' }}>
        <iframe 
          title={currentExample.title}
          src={`sandbox?src=${currentExample.url}`}
          frameBorder="0"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
        />
      </div>
    );
  }

  getCurrentExample = () => {
    const search = this.props.location && this.props.location.search;
    if (!search) {
      return null;
    }
    const params = new URLSearchParams(search);
    const exampleUrl = params && params.get('url');
    if (!exampleUrl) {
      return null;
    }
    return examples.find(ex => ex.url === exampleUrl);
  }

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
                    { this.renderExamplesContainer() }               
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