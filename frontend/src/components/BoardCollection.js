import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { 
  Card,
  Image,
  Icon,
  Input,
} from 'semantic-ui-react';

import { s, t } from '../styles';

export default class BoardCollection extends Component {
  state = { filter: '' };
  renderCard = item => {
    const {
      url,
      name,
      description,
      metadata,
      image,
      repo
    } = item;
    return (
      <Card
        style={s(t.p10, { maxWidth: 300 })}
        key={`board-card-${name}`}
      >
        <Card.Content>
          {
            !repo ? (
              <Image
                floated="right"
                size="mini"
                src={image || '/assets/shutterstock_1196210650.png'}
                style={{ marginTop: 3 }}
              />
            ) : (
              <Image 
                floated="right"
                size="mini"
                style={{ marginTop: 3 }}
              >
                <a href={repo} target="_blank" rel="noreferrer">
                  <Icon size="large" name="github" />
                </a>
              </Image>
            )
          }
          <Link
            key={`board-card-link-${name}`}
            to={url}
          > 
            <Card.Header style={{ marginTop: 3, textAlign: 'left', color: '#4183c4' }}>
              <h1 style={t.fs15}>{name}</h1>
            </Card.Header>
            {
              metadata && (
                <Card.Meta style={{ margin: '5px 0px', textAlign: 'left' }}>
                  {metadata}
                </Card.Meta>
              )
            }
            <Card.Description style={{ marginTop: 10, color: 'rgb(84 84 84)' }}>
              <div style={t.tl}>
                { description || 'No description available' }
              </div>
            </Card.Description>
          </Link>
        </Card.Content>
      </Card>
    );
  }

  renderBoards = items => {
    const { 
      height=120,
      style={} 
    } = this.props;
    const { filter } = this.state;
    return (
      <Card.Group 
        itemsPerRow={2}
        style={{
          height, 
          overflowY: 'auto',
          margin: 'auto',
          padding: 10,
          ...style
        }}
      >
        {
          items.filter(x => !filter || x.name.toLowerCase().indexOf(filter) !== -1)
            .map(this.renderCard) 
        }
      </Card.Group>
    );
  }

  render() {
    const { 
      items, 
      headline,
    } = this.props;
    const { filter } = this.state;
    return items.length > 0 && (
      <div style={{ border: 'solid 1px #ccc', borderRadius: 3 }}>
        <h1 style={s(t.mt15, t.tc, t.fs14, t.p(0, 0))}> 
          {headline} 
        </h1>
        <div style={s(t.tr, t.mb5)}>
          <Input
            icon='search'
            style={{ marginRight: 20 }}
            value={filter}
            onChange={(_, { value }) => this.setState({ filter: value.toLowerCase() })}
          />
        </div>
        { this.renderBoards(items) }
      </div>
    )
  }
}