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
import DataModelReference from '../../components/DataModelReference';

import Modal from '../../components/Modal';
import ServiceReference from '../../components/ServiceReference';
import { s, t } from '../../styles';

import examples from './ExamplesData';

function* tokenize(str) {
  if (!str) {
    return '';
  }

  let spos = 0;
  while (spos < str.length) {
    const begin = str.indexOf('[', spos);
    if (begin === -1) {
      return str.substr(spos);
    }

    if (begin > spos) {
      yield str.substr(spos, begin - spos);
      spos = begin;
    }

    const end = str.indexOf(')', begin + 1);
    if (end !== -1) {
      const nameEnd = str.indexOf(']', begin + 1);
      const linkBegin = str.indexOf('(', nameEnd + 1);
      if (linkBegin !== -1 && nameEnd !== -1) {
        yield {
          type: 'link',
          name: str.substr(begin + 1, nameEnd - begin - 1),
          link: str.substr(linkBegin + 1, end - linkBegin - 1),
        }
      }
    } else { // syntax error: closing bracket missing
      return str.substr(spos);
    }
    spos = end + 1;
  }
}

export default class Examples extends Component {
  state = {
    currentExample: undefined,
    modalReferenceDatamodel: undefined,
  };

  renderCard = example => {
    const fontStyle = s(t.ls1, t.uc, t.fs12, t.tc);
    return (
      <Link
        key={`example-link-${example.title}`}
        style={s(t.m10, { flex: 1, width: 0, minWidth: 200 })}
        to={`/examples?url=${example.url}`}
      >       
        <Card 
          key={`example-card-${example.title}`}
          style={{ ...fontStyle, minHeight: 250 }}
        >
          <Card.Content>
            <Image
              floated="right"
              size="mini"
              src={example.image}
              style={{ marginTop: 3 }}
            />
            <Card.Header
              style={{ marginTop: 3, textAlign: 'left', color: '#4183c4' }}
            >
              {example.title}
            </Card.Header>
            <Card.Meta style={{ margin: '5px 0px', textAlign: 'left' }}>
              {example.brief}
            </Card.Meta>
            <Card.Description style={{ marginTop: 10 }}>
              <div style={t.tl}>
                {
                  Array.isArray(example.description) ? 
                    example.description.map((d, idx) => (
                      <p
                        key={`example-${example.title}-desc-${idx}`}
                        style={t.lh1_7}
                      >
                        {d}
                      </p> )) : 
                    example.description
                }
              </div>
            </Card.Description>
          </Card.Content>
        </Card>
      </Link>
    );
  }

  renderExamples = () => (
    <Card.Group style={{ display: 'flex' }}>
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
          height: currentExample && '100%'
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
            height: '100%',
          }}
        >
        { !currentExample && this.renderDisclaimer() }
        {
          currentExample ? 
            this.renderCurrentExample() : 
            this.renderExamples()
        }
        </div>
      </div>
    );
  }

  renderExplanation = explanation => {
    const { modalReferenceDatamodel } = this.state;
    const isServiceReference = modalReferenceDatamodel && modalReferenceDatamodel.link.startsWith('/service');
    const serviceName = isServiceReference && modalReferenceDatamodel.link.split('/').pop();

    if (!explanation) {
      return false;
    }

    return (
      <div style={s(t.uc, t.fs12, t.ls1, t.m(0, 10), t.lh1_5)}>
        {
          Array.from(tokenize(explanation)).map((p, idx) => 
              typeof p === 'string' ? (
                <span 
                  key={`example-explanation-part-${idx}`}
                > 
                  { p } 
                </span>
              ) : (
                <span
                  key={`example-explanation-part-${idx}`} 
                  style={{ 
                    color: '#4183c4', 
                    cursor: 'pointer',
                    fontStyle: 'italic',
                  }}
                  onClick={() => this.setState({ modalReferenceDatamodel: p })}
                > 
                  { ` ${p.name} ` }
                </span>
              )
          ) 
        }
        <Modal
          title={serviceName ? 'Service Documentation' : 'Datamodel Documentation'}
          component={modalReferenceDatamodel && (
             serviceName ? 
              <ServiceReference service={serviceName} name={modalReferenceDatamodel.name} /> :
              <DataModelReference name={modalReferenceDatamodel.name} />
          )}
          url={modalReferenceDatamodel && modalReferenceDatamodel.link}
          setOpen={open => !open && this.setState({ modalReferenceDatamodel: undefined })}
          isOpen={!!this.state.modalReferenceDatamodel}
        />
      </div>
    );
  }

  renderCurrentExample = () => {
    const currentExample = this.getCurrentExample();
    if (!currentExample) {
      return false;
    }
    return (
      <div style={t.fill}>
        <div style={{ maxHeight: '20%' }}>
          { this.renderExplanation(currentExample.explanation) }
        </div>
        <iframe 
          title={currentExample.title}
          src={`sandbox?src=${currentExample.url}`}
          frameBorder="0"
          style={{
            width: '100%',
            height: '80%',
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

  renderDisclaimer = () => {
    return (
      <div style={{ marginBottom: 30 }}>
        <Message
          style={{
            letterSpacing: 1,
            textTransform: 'uppercase',
            fontSize: 12,
            textAlign: 'left',
          }}
        >
          <p>
            Usecases shown in this examples are a small fraction of the possibilities. 
            Examples run in a Sandbox. Purpose of the Sandbox is to hookup 
            workflows that rely on the current browser only and do not need external resources.
          </p>

          <p>
            More magic happens when mixing persistent and volatile runtimes on multiple devices.
          </p>

          <p>
            For these use-cases a login is needed, which is currently scoped to a closed group. 
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