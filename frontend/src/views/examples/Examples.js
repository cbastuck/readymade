import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { 
  Card,
  Image,
  Breadcrumb,
  Message,
} from 'semantic-ui-react'

import { AppConsumer } from '../../AppContext';
import BoardContext, { BoardConsumer } from '../../BoardContext';
import Toolbar from '../../components/Toolbar';
import Footer from '../../components/Footer';

const examples = [
  {
    title: 'Hello World',
    brief: 'The mother of examples',
    description: [
      'This example is showing the basic structure of a hookup chain',
      'Try double-clicking the canvas and realize this is the service that is used in the quick pitch and the thought-experiment on the start-page'
    ],
    image: '/assets/shutterstock_1196210650.png',
    url: '/boards/examples/helloworld.json'
  },
  {
    title: 'Audiolize',
    brief: 'Visualizaton for the ear',
    description: [
      'Instead of looking at discrete pixels of performance graphs, why not using a sense that has a better resolution.',
      'Hear who makes changes on wikipedia: a bot or human user'
    ],
    image: '/assets/shutterstock_1196210650.png',
    url: '/boards/examples/audiolize.json'
  },
  {
    title: 'Dropbox',
    brief: 'Upload into your Dropbox',
    description: 'Every 10 seconds make a picture with the camera and upload it into your Dropbox (once authorized and granted access)',
    image: '/assets/shutterstock_1196210650.png',
    url: '/boards/examples/dropbox.json'
  },
  {
    title: 'Trigger Pad',
    brief: 'Control the output',
    description: 'Record sounds in your environment, put them on a launchpad and start playing with them',
    image: '/assets/shutterstock_1196210650.png',
    url: '/boards/examples/triggerpad.json'
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
            style={{ marginTop: 3, textAlign: 'left' }}
          >
            {example.title}
          </Card.Header>
          <Card.Meta style={{ margin: '5px 0px', textAlign: 'left' }}>
            {example.brief}
          </Card.Meta>
          <Card.Description style={{ marginTop: 10 }}>
            <div style={{ textAlign: 'left' }}>
              {Array.isArray(example.description) ? 
                example.description.map(d => <p>{d}</p> ) : 
                example.description}
            </div>
          </Card.Description>
        </Card.Content>
        <Card.Content extra>
          <Link
            style={{
              ...fontStyle, 
              color: '#4284C4',
            }}
            to={`/examples?url=${example.url}`}
          >
            <div style={{ margin: '5px 0px' }}>
              Show Board
            </div>
          </Link>
        </Card.Content>
      </Card>
    );
  }

  renderExamples = () => (
    <Card.Group>
      { 
        examples.map(ex => this.renderCard(ex)) 
      }
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
          height: '100%'
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
        { !currentExample && this.renderExplainer() }
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

  renderExplainer = () => {
    return (
      <div
        style={{
          marginBottom: 30
        }}
      >
        <Message
          style={{
            letterSpacing: 1,
            textTransform: 'uppercase',
            fontSize: 12,
            textAlign: 'left',
          }}
        >
          <p>
            Everything shown in the exampels is a fraction of the possibilities. 
            Examples run in a Sandbox. Purpose of the Sandbox is to build hookup 
            workflows that only rely on the current browser state and need no external resources.
          </p>

          <p>
            The real magic happens when you start mixing persistent and volatile runties 
            on multiple devices.
          </p>

          <p>
            But for this an account is needed, which is not a public feature atm.
          </p>
        </Message>
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