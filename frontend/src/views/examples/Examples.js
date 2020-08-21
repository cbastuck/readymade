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

import './Examples.css';

const examples = [
  {
    title: 'Hello World',
    brief: 'The mother of examples',
    description: 'This example is showing the basic structure of a hookup chain',
    image: '/assets/shutterstock_1196210650.png',
    url: 'sandbox?src=/boards/examples/helloworld.json'
  }
];

export default class Examples extends Component {
  state = {
    currentExample: null
  };

  renderCard = example => {
    const fontStyle = {
      letterSpacing: 1,
      textTransform: 'uppercase',
      fontSize: 12
    };
    return (
      <Card 
        key={`example-card-${example.title}`} 
        className="example-card"
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
          <div className="ui two buttons">
            <Button 
              basic
              onClick={() => this.setState({ currentExample: example })}
            >
              <span style={{...fontStyle, color: '#4284C4' }}>Show Board</span>
            </Button>
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
      fontSize: 10
    };
    const { currentExample } = this.state;
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
            onClick={() => this.setState({ currentExample: null })}
          >
            <span style={breadcrumpStyle}>
              Examples
            </span>
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
    const exampleNameStyle = {
      letterSpacing: 1,
      textTransform: 'uppercase',
      fontSize: 18
    };
    const { currentExample } = this.state;
    return (
      <div className="examples-container">
        <div 
          style={{ 
            margin: '10px 10px', 
            textAlign: 'center' ,
            marginBottom: 20
          }}
        >
          <h1 style={{ fontSize: 20, margin: 0, padding: 0 }}>
            { 
              currentExample ? (
                <span>
                  <span 
                    style={{ cursor: 'pointer', marginRight: 10, }}
                    onClick={() => this.setState({ currentExample: null }) }
                  > 
                    ❮ 
                  </span>
                  <span style={exampleNameStyle}>
                    {currentExample.title} 
                  </span>
                </span> ) : (
                  <span style={exampleNameStyle}> 
                    Examples
                  </span>
                )
            }
          </h1>
          { currentExample && this.renderBreadcrumbs() }
        </div>
        <div className="examples-list">
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
    const { currentExample } = this.state;
    return currentExample && (
      <div style={{ width: '100%', height: '100%' }}>
        <iframe 
          title={currentExample.title}
          src={currentExample.url}
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